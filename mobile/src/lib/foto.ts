import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { tamanoFinal } from './tamano.ts';

// Siempre se reconvierte a JPEG (calidad 0,8): así nunca llega HEIC al servidor, que solo admite JPEG y PNG.
export async function prepararFoto(uri: string, ancho: number, alto: number): Promise<string> {
  const contexto = ImageManipulator.manipulate(uri);
  const medida = tamanoFinal(ancho, alto);
  const imagen = await (medida ? contexto.resize(medida) : contexto).renderAsync();
  return (await imagen.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 })).uri;
}
