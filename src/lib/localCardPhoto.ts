import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { storeLocalPhoto } from './cardImageStore';
/** Invoke only from a guardian's button press. Photo never goes to the AI server. */
export async function pickLocalCardPhoto(mode: 'camera' | 'album'): Promise<string | null> {
 if (mode === 'camera' && Platform.OS !== 'web') {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('카메라 권한이 없어요. 앨범 선택이나 AI 생성을 사용할 수 있어요.');
 }
 const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .8, base64: Platform.OS === 'web', exif: false };
 // The system photo picker grants access only to the user's selected photo. No broad pre-request.
 const result = mode === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
 if (result.canceled) return null;
 const asset = result.assets[0];
 if (!asset?.uri) throw new Error('선택한 사진을 읽지 못했어요.');
 return storeLocalPhoto(asset.uri, asset.base64);
}
