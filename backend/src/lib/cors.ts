import type { RequestHandler } from 'express';

// CORS con lista cerrada de orígenes (Arquitectura §3, regla 8). La app móvil nativa no usa CORS; esto es para la web y
// para previsualizar la app móvil en un navegador durante el desarrollo. Un origen que no está en la lista no recibe
// ninguna cabecera CORS y su preflight sigue de largo (404).
export const cors = (origins: string[]): RequestHandler => (req, res, next) => {
  const origen = req.headers.origin;
  if (origen && origins.includes(origen)) {
    res.set({
      'Access-Control-Allow-Origin': origen,
      Vary: 'Origin',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
      'Access-Control-Max-Age': '600',
    });
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
  }
  next();
};
