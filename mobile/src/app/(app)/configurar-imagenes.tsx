import { ScrollView, StyleSheet } from 'react-native';
import { ImagenPerfil } from '@/components/imagen-perfil';
import { Tarjeta } from '@/components/ui';
import { espacio, useTema } from '@/theme';

// Logo y firma: salen en el PDF de tus presupuestos.
export default function LogoYFirma() {
  const t = useTema();
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: t.fondo }} contentContainerStyle={e.contenido}>
      <Tarjeta>
        <ImagenPerfil ruta="logo" titulo="Logo" nombre="el logo" ayuda="Sale arriba en tus presupuestos, en su propia fila: sirve un logo horizontal. PNG o JPEG; se ajusta solo a un tamaño liviano." vacio="Todavía no subes un logo" />
      </Tarjeta>
      <Tarjeta>
        <ImagenPerfil ruta="signature" titulo="Firma" nombre="la firma" ayuda="Se imprime sobre la línea de firma del PDF en todos tus presupuestos. Mejor sobre fondo blanco o transparente. Bajo la línea siempre salen tu nombre, teléfono y correo." vacio="Todavía no subes tu firma" />
      </Tarjeta>
    </ScrollView>
  );
}

const e = StyleSheet.create({ contenido: { padding: espacio.l, paddingBottom: espacio.xxl * 2, gap: espacio.xl } });
