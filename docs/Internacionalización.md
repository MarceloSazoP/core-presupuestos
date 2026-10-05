# Internacionalización (varios países)

**Versión 1.0 · decisión del 2026-10-04 · rama `internacionalizacion`**

CorePresupuesto nació para Chile: pesos chilenos, IVA 19 %, teléfonos `+56`, hora de Santiago. Este documento define cómo pasa a servir a **Latinoamérica hispana y España** sin cambiar el producto: el mismo flujo, en el mismo idioma (español), con la moneda, el impuesto, el teléfono y la hora de cada país.

## 1. Alcance

| Entra | No entra (por ahora) |
|---|---|
| Moneda y formato de los montos | Traducir la app a otros idiomas (inglés, portugués) |
| Impuesto con su nombre y su tasa (IVA, IGV, ITBMS) | Más de un impuesto en el mismo presupuesto |
| Teléfonos de cualquier país de la lista y envío de códigos | Decimales en los montos (ver §3) |
| Fechas y «hoy» según la zona horaria **del teléfono** | Convertir un presupuesto de una moneda a otra |
| Elegir el país en el perfil | Tipos de cambio |

Es un cambio de **configuración por usuario**, no una segunda versión del producto: la lógica de negocio sigue en el backend (`CLAUDE.md` §6).

## 2. Países

El backend es la única fuente de verdad de moneda e impuesto (`backend/src/lib/paises.ts`). Las tasas son las vigentes al escribir este documento y **cambian con la ley**: se corrigen en esa tabla.

| País | `country` | Moneda | Símbolo | Miles | Impuesto | Tasa | Prefijo |
|---|---|---|---|---|---|---|---|
| Chile | `CL` | CLP | `$` | `.` | IVA | 19 % | +56 |
| Perú | `PE` | PEN | `S/` | `,` | IGV | 18 % | +51 |
| Colombia | `CO` | COP | `$` | `.` | IVA | 19 % | +57 |
| México | `MX` | MXN | `$` | `,` | IVA | 16 % | +52 |
| Argentina | `AR` | ARS | `$` | `.` | IVA | 21 % | +54 |
| Uruguay | `UY` | UYU | `$U` | `.` | IVA | 22 % | +598 |
| Paraguay | `PY` | PYG | `₲` | `.` | IVA | 10 % | +595 |
| Bolivia | `BO` | BOB | `Bs` | `.` | IVA | 13 % | +591 |
| Ecuador | `EC` | USD | `$` | `,` | IVA | 15 % | +593 |
| Costa Rica | `CR` | CRC | `₡` | espacio | IVA | 13 % | +506 |
| Panamá | `PA` | USD | `$` | `,` | ITBMS | 7 % | +507 |
| Guatemala | `GT` | GTQ | `Q` | `,` | IVA | 12 % | +502 |
| España | `ES` | EUR | `€` (después del número) | `.` | IVA | 21 % | +34 |

El formato del monto es **por moneda**, no por país: el dólar (Ecuador, Panamá) se escribe siempre al estilo de dólar (`$1,234`). En las listas que ve el usuario, Chile va siempre primero y los demás por orden alfabético. Quedan fuera los países cuyo prefijo se comparte (`+1`: República Dominicana, Puerto Rico), porque un número sin país no dice de cuál es. Agregar uno es agregar una fila.

## 3. Decisiones

1. **El país es del usuario** (`users.country`). Al registrarse se propone el del teléfono de la cuenta (por su prefijo) o, si no se reconoce, el de la región del dispositivo; el usuario lo puede cambiar en Configurar.
2. **El presupuesto guarda su propia copia** de país, moneda, nombre y tasa del impuesto al crearse (`quotes.country`, `currency`, `vat_label`, `vat_rate`). Cambiar de país después **no altera** los presupuestos ya hechos: un PDF de hace un año sigue diciendo lo que decía. Los existentes quedan como Chile (`CL`, `CLP`, `IVA`, 19).
3. **Los montos son enteros en la unidad principal de la moneda** (pesos, soles, dólares), sin centavos. Es lo que ya guarda la base (`bigint`) y es suficiente para presupuestar trabajos. Si más adelante hace falta centavos, es una migración aparte (montos en unidad menor).
4. **La zona horaria es la del teléfono.** Cada cliente la envía (`PUT /me { timezone }`, nombre IANA como `America/Lima`) al abrir la app y cuando cambia. El servidor la usa para «hoy» (seguimientos vencidos), para el mes de los indicadores, para el año de la numeración y para las fechas del PDF. La hora de los recordatorios (09:00) es la local del teléfono. Un usuario sin zona guardada usa `America/Santiago`.
5. **Las fechas de un presupuesto ya emitido no dependen de quién lo mira.** Al finalizar se fija en el snapshot la fecha de emisión, la de validez y la zona horaria con que se calcularon (`issued_on`, `valid_until`, `timezone`); la vista pública y el PDF las muestran tal cual.
6. **Los clientes formatean, el servidor decide.** La app y la web arman el texto del monto con el código de moneda del presupuesto (mapa de 12 filas con símbolo y separador de miles; no se usa el ICU del teléfono, que no agrupa igual en todos lados). El servidor calcula el impuesto y los totales con la tasa del presupuesto (`Contrato de API.md` §6).
7. **Teléfono.** La API ya exige E.164 (`+` y 8–15 dígitos). Lo nuevo es lo que hacen los clientes cuando la persona escribe un número **sin prefijo**: se le antepone el del país del usuario, no `+56`. Un número con `+` o con el prefijo escrito se respeta tal cual.
8. **Idioma:** español para todos. Los textos que dicen «IVA» pasan a decir el nombre del impuesto del presupuesto.

## 4. Datos (migración `0012`)

Ver `Contrato de Base de Datos.md` §21.

## 5. API

Ver `Contrato de API.md`: `GET /me` y `PUT /me` (`country`, `timezone`), `GET /countries`, y los campos nuevos del presupuesto.

## 6. Pruebas que acompañan

- Cada país de la tabla: moneda, nombre y tasa correctos; un código desconocido se rechaza.
- Un presupuesto nuevo copia el país, la moneda y el impuesto del usuario; cambiar de país el usuario no modifica los ya creados.
- El total con impuesto usa la tasa del presupuesto (México 16 %, Perú 18 %) y sigue valiendo `subtotal − descuento + impuesto`.
- «Hoy» y el mes de los indicadores respetan la zona horaria del usuario (el mismo instante cae en días distintos en Santiago y en Ciudad de México).
- El PDF y la vista pública muestran el símbolo, el separador de miles y el nombre del impuesto del presupuesto, y la fecha fijada en el snapshot.
- Clientes: formato de montos por moneda, teléfono sin prefijo con el país del usuario y con prefijo propio respetado.

## 7. Riesgos y límites

- Las tasas de impuesto cambian: la tabla se versiona en el código y cada presupuesto guarda la suya.
- Sin centavos, un precio en una moneda de poco valor por unidad (PYG) es cómodo, pero uno en USD con centavos no se puede escribir. Es una limitación conocida del MVP.
- El formato de miles sale de una tabla propia; si un país usa otro (`'`, por ejemplo), se agrega a esa tabla.
- Para que la web muestre bien un presupuesto, el servidor debe entregarle siempre la moneda y el impuesto con el presupuesto.
