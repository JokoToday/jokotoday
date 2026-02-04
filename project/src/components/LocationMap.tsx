import { MapPin, Navigation } from 'lucide-react';
import { Location } from '../data/locations';
import { useLanguage } from '../context/LanguageContext';

type LocationMapProps = {
  location: Location;
};

export default function LocationMap({ location }: LocationMapProps) {
  const { t } = useLanguage();

  const getLocationName = (id: string) => {
    return id === 'mae-rim' ? t.location.maeRimName : t.location.inTownName;
  };

  const getLocationAddress = (id: string) => {
    return id === 'mae-rim' ? t.location.maeRimAddress : t.location.inTownAddress;
  };

  const getLocationDays = (id: string) => {
    return id === 'mae-rim' ? t.location.maeRimDays : t.location.inTownDays;
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-5 w-5 text-amber-700" />
          <h3 className="text-lg font-semibold text-amber-900">{getLocationName(location.id)}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-2">{getLocationAddress(location.id)}</p>
        <p className="text-sm text-amber-700 font-medium mb-4">
          {t.location.open}: {getLocationDays(location.id)}
        </p>
      </div>

      <a
        href={location.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-amber-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors shadow-md"
      >
        <Navigation className="h-5 w-5" />
        <span>{t.location.getDirections}</span>
      </a>
    </div>
  );
}
