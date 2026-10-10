import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // En desarrollo se puede abrir la web desde otro equipo de la red con la IP de este computador (por ejemplo http://192.168.1.20:3012 desde un
  // notebook): Next bloquea por defecto lo que pide otro origen. Solo redes privadas; no tiene efecto en producción.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // Calidades que puede pedir <Image> (Next 16 exige la lista): 90 para la foto de los equipos de la portada, que tiene letra chica.
  images: { qualities: [75, 90] },
};

export default nextConfig;
