# Shared Types

Tipos TypeScript compartidos entre Backend, Frontend Web y Mobile.

## Uso

### En Backend
```typescript
import { User, Quote } from '../shared/types';
```

### En Frontend Web
```typescript
import { User, Quote } from '@/shared/types';
```

### En Mobile
```typescript
import { User, Quote } from '../../shared/types';
```

## Contenido

- `types.ts` — Interfaces principales de dominio (User, Customer, Quote, etc)

**Nota:** Estos tipos deben ser los únicos que se repliquen en los tres proyectos. La lógica de negocio se centraliza en el Backend.
