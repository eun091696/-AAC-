import { Alert, Platform } from 'react-native';

/** 확인 창. 웹(react-native-web)은 Alert 버튼을 지원하지 않아 window.confirm 사용 */
export function confirmAsync(title: string, message: string, okText = '확인', cancelText = '취소'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: okText, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
