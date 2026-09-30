import * as FileSystem from 'expo-file-system/legacy';
/** Keep binary images out of AsyncStorage (Android has a per-entry read limit). */
export async function storeCardImage(dataUri: string): Promise<string> {
 if (!FileSystem.documentDirectory) throw new Error('이미지 저장 공간을 사용할 수 없어요.');
 const directory = `${FileSystem.documentDirectory}card-images/`;
 await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
 const uri = `${directory}${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
 try {
  await FileSystem.writeAsStringAsync(uri, dataUri.split(',')[1], { encoding: FileSystem.EncodingType.Base64 });
  return uri;
 } catch { throw new Error('그림을 기기에 저장하지 못했어요. 저장 공간을 확인해 주세요.'); }
}
