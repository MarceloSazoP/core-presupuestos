import assert from "node:assert/strict";
import { test } from "node:test";
import { dinero, paisDe, separadorDe } from "./paises.ts";
import { normalizarTelefono } from "./telefono.ts";
import { calcularTotales } from "./totales.ts";

test("el monto lleva el símbolo y el separador de su moneda", () => {
  assert.equal(dinero(1234567, "CLP"), "$1.234.567");
  assert.equal(dinero(1234567, "PEN"), "S/ 1,234,567");
  assert.equal(dinero(1234567, "USD"), "$1,234,567");
  assert.equal(dinero(5000), "$5.000", "sin moneda, la de Chile");
  assert.equal(separadorDe("MXN"), ",");
  assert.equal(paisDe("ZZ").country, "CL");
});

test("el teléfono sin prefijo toma el del país del presupuesto; con «+» no se toca", () => {
  assert.equal(normalizarTelefono("987 654 321", "+51"), "+51987654321");
  assert.equal(normalizarTelefono("+56 9 5482 2089", "+51"), "+56954822089");
  assert.equal(normalizarTelefono("954822089"), "+56954822089", "por defecto, Chile");
  assert.equal(normalizarTelefono("123", "+51"), null);
});

test("el impuesto usa la tasa del presupuesto", () => {
  const items = [{ descripcion: "x", cantidad: 1, precioUnitario: 100000 }];
  assert.equal(calcularTotales(items, 0, true, 16).iva, 16000);
  assert.equal(calcularTotales(items, 0, true).iva, 19000);
});
