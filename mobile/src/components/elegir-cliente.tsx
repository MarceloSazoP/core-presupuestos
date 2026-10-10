import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Searchbar, Text, TouchableRipple } from 'react-native-paper';
import type { Cliente } from '@/api/types';
import { HojaM } from '@/components/material';
import { Icono } from '@/components/ui';
import { coincideCliente } from '@/lib/buscar';
import { cargarClientes, iniciales, telefonoLegible } from '@/lib/clientes';
import { espacio, MIN_TOQUE, useTema } from '@/theme';

// Un cliente en una lista: sus iniciales en un círculo, el nombre y el teléfono; tocarlo hace `alTocar`. `derecha`: lo que va al final
// (por defecto, la flecha de «ver más»).
export function FilaCliente({ c, alTocar, derecha }: { c: Cliente; alTocar: () => void; derecha?: ReactNode }) {
  const t = useTema();
  return (
    <TouchableRipple accessibilityRole="button" accessibilityLabel={`${c.name}, ${telefonoLegible(c.phone)}`} onPress={alTocar} style={e.fila}>
      <View style={e.contenido}>
        <View style={[e.circulo, { backgroundColor: `${t.acento}${t.oscuro ? '33' : '1F'}` }]}>
          <Text variant="titleSmall" style={{ color: t.acento }}>{iniciales(c.name)}</Text>
        </View>
        <View style={e.textos}>
          <Text variant="bodyLarge" numberOfLines={1} style={[e.nombre, { color: t.texto }]}>{c.name}</Text>
          <Text variant="bodyMedium" numberOfLines={1} style={[e.cifra, { color: t.suave }]}>{telefonoLegible(c.phone)}</Text>
        </View>
        {derecha ?? <Icono nombre="siguiente" tamano={18} color={t.suave} />}
      </View>
    </TouchableRipple>
  );
}

// Buscador de clientes guardados para Nuevo presupuesto (Arquitectura §5): por nombre o teléfono, también sin señal (usa la copia del
// teléfono). Elegir uno lo devuelve y cierra.
export function ElegirCliente({ alElegir, alCerrar }: { alElegir: (c: Cliente) => void; alCerrar: () => void }) {
  const t = useTema();
  const [lista, setLista] = useState<Cliente[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  useEffect(() => {
    void cargarClientes().then((r) => setLista(r.lista));
  }, []);
  const visibles = (lista ?? []).filter((c) => !busqueda.trim() || coincideCliente(c, busqueda));
  return (
    <HojaM titulo="Elegir cliente" alCerrar={alCerrar}>
      <Searchbar
        placeholder="Nombre o teléfono"
        value={busqueda}
        onChangeText={setBusqueda}
        icon={({ size, color }) => <Icono nombre="buscar" tamano={size} color={color} />}
        clearIcon={({ size, color }) => <Icono nombre="borrar" tamano={size} color={color} />}
        clearAccessibilityLabel="Borrar la búsqueda"
        autoCorrect={false}
        autoFocus
        elevation={0}
        style={[e.buscador, { backgroundColor: t.campo }]}
        inputStyle={e.textoBuscador}
      />
      {lista === null ? (
        <ActivityIndicator color={t.acento} style={e.cargando} />
      ) : visibles.length ? (
        <View style={[e.lista, { backgroundColor: t.tarjeta }]}>
          {visibles.map((c, i) => (
            <View key={c.id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.borde } : null}>
              <FilaCliente c={c} alTocar={() => alElegir(c)} derecha={<View />} />
            </View>
          ))}
        </View>
      ) : (
        <Text variant="bodyMedium" style={[e.vacio, { color: t.suave }]}>
          {lista.length ? `Ningún cliente coincide con «${busqueda.trim()}».` : 'Aún no tienes clientes guardados. Se guardan solos al crear un presupuesto.'}
        </Text>
      )}
    </HojaM>
  );
}

const e = StyleSheet.create({
  fila: { paddingVertical: 12, paddingHorizontal: espacio.l },
  contenido: { flexDirection: 'row', alignItems: 'center', gap: espacio.l, minHeight: MIN_TOQUE },
  circulo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
  nombre: { fontWeight: '600' },
  cifra: { fontVariant: ['tabular-nums'] },
  buscador: { borderRadius: 999 },
  textoBuscador: { fontSize: 16 },
  cargando: { marginTop: espacio.xl },
  lista: { borderRadius: 16, overflow: 'hidden' },
  vacio: { textAlign: 'center', paddingHorizontal: espacio.l, paddingTop: espacio.l },
});
