#!/usr/bin/env bash
# 콕톡 AWS 초기 설정 (한 번만 실행). 사용: bash scripts/aws/setup.sh
#  1) 예산 알림  2) Lightsail 컨테이너 서비스  3) 깃허브 배포 전용 IAM 사용자  4) 깃허브 Secrets 등록
# 키 값은 화면에 출력하지 않음. 이미 만들어진 것은 건너뜀.
set -euo pipefail
cd "$(dirname "$0")/../.."
P=koktok
R=ap-northeast-2
SERVICE=koktok-api
USER_NAME=koktok-github-deploy
EMAIL=eun091696@gmail.com
BUDGET_USD=15
KEYFILE=.env.aws-deploy.local
A="aws --profile $P"

ok() { printf '  ✔ %s\n' "$1"; }
step() { printf '\n[%s] %s\n' "$1" "$2"; }

step 0 "로그인 확인"
ACCOUNT=$($A sts get-caller-identity --query Account --output text)
ok "계정 확인 완료 (끝자리 ${ACCOUNT: -4})"

step 1 "예산 알림 (월 \$${BUDGET_USD}, 80% 사용 / 100% 예상 시 메일)"
if $A budgets describe-budget --account-id "$ACCOUNT" --budget-name koktok-monthly >/dev/null 2>&1; then
  ok "이미 있음"
else
  $A budgets create-budget --account-id "$ACCOUNT" \
    --budget "{\"BudgetName\":\"koktok-monthly\",\"BudgetLimit\":{\"Amount\":\"$BUDGET_USD\",\"Unit\":\"USD\"},\"TimeUnit\":\"MONTHLY\",\"BudgetType\":\"COST\"}" \
    --notifications-with-subscribers "[
      {\"Notification\":{\"NotificationType\":\"ACTUAL\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":80,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$EMAIL\"}]},
      {\"Notification\":{\"NotificationType\":\"FORECASTED\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":100,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$EMAIL\"}]}
    ]"
  ok "만듦 → $EMAIL 로 알림"
fi

step 2 "Lightsail 컨테이너 서비스 ($SERVICE, 서울, Micro 1GB, 1대)"
if $A lightsail get-container-services --region $R --service-name $SERVICE >/dev/null 2>&1; then
  ok "이미 있음"
else
  $A lightsail create-container-service --region $R --service-name $SERVICE --power micro --scale 1 >/dev/null
  ok "만듦 (준비되는 데 몇 분 걸려요)"
fi

step 3 "깃허브 배포 전용 IAM 사용자 ($USER_NAME, Lightsail 배포 권한만)"
if $A iam get-user --user-name $USER_NAME >/dev/null 2>&1; then
  ok "사용자 이미 있음"
else
  $A iam create-user --user-name $USER_NAME >/dev/null
  ok "사용자 만듦"
fi
$A iam put-user-policy --user-name $USER_NAME --policy-name koktok-lightsail-deploy --policy-document '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "lightsail:GetContainerServices",
      "lightsail:GetContainerImages",
      "lightsail:CreateContainerServiceRegistryLogin",
      "lightsail:RegisterContainerImage",
      "lightsail:DeleteContainerImage",
      "lightsail:CreateContainerServiceDeployment",
      "lightsail:GetContainerServiceDeployments",
      "lightsail:GetContainerLog"
    ],
    "Resource": "*"
  }]
}'
ok "권한 연결 (Lightsail 컨테이너 배포만 가능)"
if [ -s "$KEYFILE" ]; then
  ok "액세스 키 파일 이미 있음 ($KEYFILE)"
else
  read -r KID SECRET < <($A iam create-access-key --user-name $USER_NAME --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
  umask 077
  printf 'AWS_ACCESS_KEY_ID=%s\nAWS_SECRET_ACCESS_KEY=%s\n' "$KID" "$SECRET" > "$KEYFILE"
  ok "액세스 키 만들어서 $KEYFILE 에 저장 (깃에 안 올라감)"
fi

step 4 "깃허브 Secrets 등록"
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  set -a; . "./$KEYFILE"; set +a
  OPENAI_API_KEY=$(grep '^OPENAI_API_KEY=' server/.env | cut -d= -f2-)
  printf '%s' "$AWS_ACCESS_KEY_ID" | gh secret set AWS_ACCESS_KEY_ID
  printf '%s' "$AWS_SECRET_ACCESS_KEY" | gh secret set AWS_SECRET_ACCESS_KEY
  printf '%s' "$OPENAI_API_KEY" | gh secret set OPENAI_API_KEY
  ok "AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, OPENAI_API_KEY 등록"
else
  echo "  ! gh(깃허브 명령 도구)가 없거나 로그인 안 됨 → 이 단계만 Aside에 알려주세요"
fi

printf '\n완료. 서버 주소는 첫 배포 후에 생겨요.\n'
