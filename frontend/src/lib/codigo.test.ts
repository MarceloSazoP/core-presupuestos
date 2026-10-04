import assert from "node:assert/strict";
import { test } from "node:test";
import { formatearCodigo } from "./codigo.ts";

test("el código se escribe en mayúsculas y con el guion después de 6", () => {
  assert.equal(formatearCodigo("7k4m2q"), "7K4M2Q");
  assert.equal(formatearCodigo("7k4m2qx9d2p4htrb"), "7K4M2Q-X9D2P4HTRB");
});

test("pegar con guion, espacios o de más no rompe el formato", () => {
  assert.equal(formatearCodigo(" 7K4M2Q - X9D2P4HTRB "), "7K4M2Q-X9D2P4HTRB");
  assert.equal(formatearCodigo("7K4M2Q-X9D2P4HTRBZZZ"), "7K4M2Q-X9D2P4HTRB");
});

test("corrige I, L y O, y descarta lo que no existe en el alfabeto", () => {
  assert.equal(formatearCodigo("IL0O U!"), "1100");
});

test("al borrar el guion no queda uno colgando", () => {
  assert.equal(formatearCodigo("7K4M2Q-"), "7K4M2Q");
  assert.equal(formatearCodigo(""), "");
});
