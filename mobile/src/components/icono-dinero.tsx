import { View } from 'react-native';
import { Icono } from '@/components/ui';
import { useTema } from '@/theme';

// El billete en un círculo verde: marca todo lo que es un total. `tamano` es el diámetro del círculo.
export function IconoDinero({ tamano = 36 }: { tamano?: number }) {
  const t = useTema();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: t.totalFondo, alignItems: 'center', justifyContent: 'center' }}>
      <Icono nombre="dinero" tamano={Math.round(tamano * 0.55)} color={t.totalTinta} />
    </View>
  );
}
