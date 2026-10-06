// Cuándo terminó el último deslizado horizontal. Soltar el dedo después de deslizar no debe contar como un toque en una tarjeta.
let ultimo = 0;
export const marcarDeslizado = () => void (ultimo = Date.now());
export const hayDeslizadoReciente = (ms = 400) => Date.now() - ultimo < ms;
