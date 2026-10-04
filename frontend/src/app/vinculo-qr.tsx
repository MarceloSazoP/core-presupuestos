"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { crearVinculoAction, esperarVinculoAction, type Vinculo } from "./actions";

// QR por visita para abrir un presupuesto en este computador sin escribir el código (Mecanismo de consulta, v1.3).
// La app, ya logueada, lo escanea desde «Ver en la web» dentro de cada presupuesto.
const CADA_MS = 2000;

type Fase = { tipo: "cargando" } | { tipo: "error"; mensaje: string } | { tipo: "activo"; v: Vinculo; listo: boolean };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function VinculoQr() {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>({ tipo: "cargando" });
  const [ahora, setAhora] = useState(() => Date.now());
  const [tactil, setTactil] = useState(false);

  const generar = useCallback(async () => {
    const r = await crearVinculoAction();
    setAhora(Date.now());
    setFase("error" in r ? { tipo: "error", mensaje: r.error } : { tipo: "activo", v: r, listo: false });
  }, []);

  // Un teléfono o una tablet no pueden escanearse a sí mismos: ahí no se pide un QR.
  useEffect(() => {
    const t = window.matchMedia("(pointer: coarse)").matches;
    setTactil(t); // eslint-disable-line react-hooks/set-state-in-effect -- depende del navegador, no se conoce al renderizar en el servidor
    if (!t) void generar();
  }, [generar]);

  const activo = fase.tipo === "activo" ? fase : null;
  const restante = activo ? Math.max(0, Math.ceil((Date.parse(activo.v.expiraEn) - ahora) / 1000)) : 0;
  const vencido = activo !== null && !activo.listo && restante === 0;
  const esperando = activo !== null && !activo.listo && !vencido;

  // Cuenta regresiva.
  useEffect(() => {
    if (!esperando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [esperando]);

  // Pregunta a la API cada 2 s si la app ya escaneó el QR (solo con la pestaña a la vista).
  useEffect(() => {
    if (!activo || !esperando) return;
    const { id, secret } = activo.v;
    let enCurso = false;
    const t = setInterval(async () => {
      if (enCurso || document.hidden) return;
      enCurso = true;
      const r = await esperarVinculoAction(id, secret);
      enCurso = false;
      if (r === "listo") {
        setFase({ tipo: "activo", v: activo.v, listo: true });
        router.push("/presupuesto");
      } else if (r === "vencido") setAhora(Date.parse(activo.v.expiraEn) + 1000);
    }, CADA_MS);
    return () => clearInterval(t);
  }, [activo, esperando, router]);

  // Al volver a la pestaña con el QR vencido se renueva solo.
  useEffect(() => {
    if (!vencido) return;
    const volver = () => !document.hidden && void generar();
    document.addEventListener("visibilitychange", volver);
    return () => document.removeEventListener("visibilitychange", volver);
  }, [vencido, generar]);

  if (tactil) {
    return <p className="ayuda">Para abrir tu presupuesto sin escribir el código, entra a esta página desde un computador y escanea el QR con la app.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="seccion text-lg">Escanéalo con la app</h3>
        <p className="ayuda">Abre el presupuesto en este computador, sin escribir nada.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative size-32 shrink-0 overflow-hidden rounded-lg border border-borde bg-white p-1.5">
          {activo ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen generada en el servidor (data URL), no hay nada que optimizar
            <img src={activo.v.qr} alt="Código QR para abrir un presupuesto desde la app de CORE Presupuestos" width={116} height={116} className={`size-full transition-[filter,opacity] duration-200 ${vencido || activo.listo ? "opacity-30 blur-sm" : ""}`} />
          ) : (
            <div className="grid size-full place-items-center">{fase.tipo === "cargando" && <span className="spinner" aria-hidden="true" />}</div>
          )}
          {(vencido || fase.tipo === "error") && (
            <button type="button" onClick={() => void generar()} className="absolute inset-0 grid place-items-center text-sm font-semibold underline underline-offset-4">
              {fase.tipo === "error" ? "Reintentar" : "Generar otro QR"}
            </button>
          )}
        </div>

        <ol className="flex list-decimal flex-col gap-1.5 pl-4 text-sm marker:font-semibold">
          <li>Abre la app</li>
          <li>Elige el presupuesto</li>
          <li>
            Toca <strong>Ver en la web</strong>
          </li>
        </ol>
      </div>

      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted">
        {fase.tipo === "cargando" && "Preparando el QR…"}
        {fase.tipo === "error" && `${fase.mensaje} Escribe el código.`}
        {esperando && `Vence en ${mmss(restante)}`}
        {vencido && "Este QR venció."}
        {activo?.listo && "Listo, abriendo tu presupuesto…"}
      </p>
    </div>
  );
}
