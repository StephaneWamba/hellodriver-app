import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageSpinner, Spinner } from '@/components/ui/Spinner';
import { IconMap, IconPhone } from '@/components/ui/icons';
import { fetchLiveDrivers } from './api';

const LIBREVILLE_CENTER: [number, number] = [0.3924, 9.4536];

function driverIcon(available: boolean) {
  const color = available ? '#16a34a' : '#2563eb';
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

export function LiveMapPage() {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['drivers', 'live'],
    queryFn: fetchLiveDrivers,
    refetchInterval: 8_000,
  });

  const drivers = data?.data ?? [];

  return (
    <AppShell
      title="Carte en direct"
      description="Chauffeurs actuellement en ligne"
      actions={isFetching && !isLoading ? <Spinner size={16} /> : undefined}
    >
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
          <Card className="overflow-hidden p-0 lg:col-span-3">
            <div className="h-[70vh] w-full">
              <MapContainer center={LIBREVILLE_CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                {drivers.map((d) => (
                  <Marker key={d.id} position={[d.latitude, d.longitude]} icon={driverIcon(!d.hasActiveTrip)}>
                    <Popup>
                      <p className="text-sm font-semibold text-ink">{d.firstName} {d.lastName}</p>
                      <p className="text-xs text-muted-foreground">{d.phone}</p>
                      <p className="mt-1 text-xs">
                        {d.hasActiveTrip ? 'En course' : 'Disponible'}
                      </p>
                      <Link to={`/utilisateurs/${d.id}`} className="text-xs font-medium text-primary hover:underline">
                        Voir le profil →
                      </Link>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </Card>

          <Card className="overflow-hidden lg:col-span-1">
            <CardHeader>
              <CardTitle>Chauffeurs en ligne ({drivers.length})</CardTitle>
            </CardHeader>
            <div className="max-h-[64vh] overflow-y-auto scrollbar-thin">
              {drivers.length === 0 ? (
                <EmptyState icon={<IconMap />} title="Aucun chauffeur en ligne" description="Reviens plus tard." />
              ) : (
                <div className="divide-y divide-border">
                  {drivers.map((d) => (
                    <Link
                      key={d.id}
                      to={`/utilisateurs/${d.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken/60"
                    >
                      <Avatar src={d.avatarUrl} firstName={d.firstName} lastName={d.lastName} size={36} tone="driver" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{d.firstName} {d.lastName}</p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <IconPhone className="h-3 w-3" /> {d.phone}
                        </p>
                      </div>
                      <Badge tone={d.hasActiveTrip ? 'primary' : 'success'}>
                        {d.hasActiveTrip ? 'En course' : 'Dispo'}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
