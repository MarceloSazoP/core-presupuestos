// En la web (vista previa) los archivos no se copian: se usa el mismo enlace.
export const guardarArchivo = async (uri: string) => uri;
export const existeArchivo = (_uri: string) => true;
export const borrarArchivo = (_uri: string) => {};
