# Implementación de Suscripciones en el Frontend

## Endpoints Disponibles

### 1. Obtener Tiers de Suscripción
```typescript
GET /api/subscription/tiers
```
Respuesta:
```json
[
  {
    "id": "tier_id",
    "name": "pro",
    "displayName": "Plan Pro",
    "description": "Acceso completo a todas las funciones",
    "features": ["Feature 1", "Feature 2"],
    "price": 29.99,
    "currency": "USD",
    "interval": "month"
  }
]
```

### 2. Verificar Estado de Suscripción
```typescript
GET /api/subscription/status
```
Respuesta:
```json
{
  "hasActiveSubscription": true,
  "subscriptionStatus": "ACTIVE",
  "subscriptionTier": "pro",
  "subscriptionExpiresAt": "2024-02-01T00:00:00Z"
}
```

### 3. Crear Sesión de Checkout
```typescript
POST /api/subscription/checkout-session
Content-Type: application/json

{
  "tierName": "pro"
}
```
Respuesta:
```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

### 4. Crear Sesión del Portal de Facturación
```typescript
POST /api/subscription/billing-portal
```
Respuesta:
```json
{
  "billingPortalUrl": "https://billing.stripe.com/p/session/..."
}
```

## Implementación en React

### 1. Hook para Gestión de Suscripciones
```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

interface SubscriptionTier {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  features: string[];
  price: number;
  currency: string;
  interval: string;
}

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  subscriptionStatus?: string;
  subscriptionTier?: string;
  subscriptionExpiresAt?: string;
}

export const useSubscription = () => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      const [tiersRes, statusRes] = await Promise.all([
        axios.get('/api/subscription/tiers'),
        axios.get('/api/subscription/status')
      ]);
      
      setTiers(tiersRes.data);
      setStatus(statusRes.data);
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCheckoutSession = async (tierName: string) => {
    try {
      const response = await axios.post('/api/subscription/checkout-session', {
        tierName
      });
      
      // Redirigir a Stripe Checkout
      window.location.href = response.data.checkoutUrl;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  };

  const openBillingPortal = async () => {
    try {
      const response = await axios.post('/api/subscription/billing-portal');
      
      // Redirigir al portal de facturación
      window.location.href = response.data.billingPortalUrl;
    } catch (error) {
      console.error('Error opening billing portal:', error);
      throw error;
    }
  };

  return {
    tiers,
    status,
    loading,
    createCheckoutSession,
    openBillingPortal,
    refreshStatus: fetchSubscriptionData
  };
};
```

### 2. Componente de Planes de Suscripción
```tsx
import React from 'react';
import { useSubscription } from './useSubscription';

export const SubscriptionPlans: React.FC = () => {
  const { tiers, status, loading, createCheckoutSession } = useSubscription();

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="subscription-plans">
      <h2>Planes de Suscripción</h2>
      
      {status?.hasActiveSubscription && (
        <div className="current-subscription">
          <p>Plan actual: {status.subscriptionTier}</p>
          <p>Estado: {status.subscriptionStatus}</p>
        </div>
      )}

      <div className="tiers-grid">
        {tiers.map((tier) => (
          <div key={tier.id} className="tier-card">
            <h3>{tier.displayName}</h3>
            <p>{tier.description}</p>
            
            <div className="price">
              ${tier.price} {tier.currency}/{tier.interval}
            </div>

            <ul className="features">
              {tier.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>

            <button
              onClick={() => createCheckoutSession(tier.name)}
              disabled={status?.subscriptionTier === tier.name}
            >
              {status?.subscriptionTier === tier.name 
                ? 'Plan Actual' 
                : 'Seleccionar Plan'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 3. Componente de Gestión de Suscripción
```tsx
import React from 'react';
import { useSubscription } from './useSubscription';

export const SubscriptionManagement: React.FC = () => {
  const { status, openBillingPortal } = useSubscription();

  if (!status?.hasActiveSubscription) {
    return <div>No tienes una suscripción activa</div>;
  }

  return (
    <div className="subscription-management">
      <h2>Gestionar Suscripción</h2>
      
      <div className="subscription-info">
        <p>Plan: {status.subscriptionTier}</p>
        <p>Estado: {status.subscriptionStatus}</p>
        {status.subscriptionExpiresAt && (
          <p>Expira: {new Date(status.subscriptionExpiresAt).toLocaleDateString()}</p>
        )}
      </div>

      <button onClick={openBillingPortal}>
        Gestionar Método de Pago / Cancelar Suscripción
      </button>
    </div>
  );
};
```

### 4. Páginas de Callback

#### Success Page (`/subscription/success`)
```tsx
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSubscription } from './useSubscription';

export const SubscriptionSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshStatus } = useSubscription();
  
  useEffect(() => {
    // Refrescar el estado de suscripción
    refreshStatus();
    
    // Redirigir después de 3 segundos
    setTimeout(() => {
      navigate('/dashboard');
    }, 3000);
  }, []);

  return (
    <div className="subscription-success">
      <h1>¡Suscripción Exitosa!</h1>
      <p>Tu suscripción ha sido activada correctamente.</p>
      <p>Serás redirigido al dashboard en unos segundos...</p>
    </div>
  );
};
```

#### Cancel Page (`/subscription/cancel`)
```tsx
import React from 'react';
import { Link } from 'react-router-dom';

export const SubscriptionCancel: React.FC = () => {
  return (
    <div className="subscription-cancel">
      <h1>Suscripción Cancelada</h1>
      <p>Has cancelado el proceso de suscripción.</p>
      <Link to="/subscription/plans">Volver a los planes</Link>
    </div>
  );
};
```

## Configuración de Rutas

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/subscription/plans" element={<SubscriptionPlans />} />
        <Route path="/subscription/manage" element={<SubscriptionManagement />} />
        <Route path="/subscription/success" element={<SubscriptionSuccess />} />
        <Route path="/subscription/cancel" element={<SubscriptionCancel />} />
      </Routes>
    </BrowserRouter>
  );
}
```

## Protección de Rutas por Suscripción

```tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSubscription } from './useSubscription';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  requiredTier?: string;
}

export const SubscriptionGuard: React.FC<SubscriptionGuardProps> = ({ 
  children, 
  requiredTier 
}) => {
  const { status, loading } = useSubscription();

  if (loading) return <div>Verificando suscripción...</div>;

  if (!status?.hasActiveSubscription) {
    return <Navigate to="/subscription/plans" />;
  }

  if (requiredTier && status.subscriptionTier !== requiredTier) {
    return <div>Necesitas el plan {requiredTier} para acceder a esta función</div>;
  }

  return <>{children}</>;
};

// Uso:
<SubscriptionGuard requiredTier="pro">
  <PremiumFeature />
</SubscriptionGuard>
```

## Configuración de Axios para Cookies

```typescript
import axios from 'axios';

// Configurar axios para enviar cookies
axios.defaults.withCredentials = true;
```

## Notas Importantes

1. **Seguridad**: El webhook está protegido mediante validación de firma de Stripe
2. **Cookies**: Todos los endpoints requieren autenticación mediante cookies (excepto el webhook)
3. **Estados de Suscripción**: ACTIVE, PAST_DUE, CANCELED, INCOMPLETE, EXPIRED, TRIALING, UNPAID, PAYMENT_FAILED
4. **Stripe Dashboard**: Configura el webhook endpoint en Stripe Dashboard: `https://tu-dominio.com/api/subscription/webhook`
5. **Variables de Entorno Necesarias**:
   - `STRIPE_API_KEY`: Clave secreta de Stripe
   - `STRIPE_WEBHOOK_SECRET`: Secreto del webhook
   - `FRONTEND_URL`: URL del frontend para redirecciones