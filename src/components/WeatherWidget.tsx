import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import './WeatherWidget.css'

interface WeatherData {
  current: {
    temperature: number
    weatherCode: number
  }
  daily: {
    date: string
    weatherCode: number
    tempMax: number
    tempMin: number
  }[]
  locationName: string
}

interface GeoResult {
  lat: number
  lon: number
  name: string
  country?: string
}

const WEATHER_CODE_MAP: Record<number, { emoji: string; desc: string }> = {
  0: { emoji: '☀️', desc: 'Sonnig' },
  1: { emoji: '🌤️', desc: 'Heiter' },
  2: { emoji: '⛅', desc: 'Bewölkt' },
  3: { emoji: '☁️', desc: 'Bedeckt' },
  45: { emoji: '🌫️', desc: 'Nebel' },
  48: { emoji: '🌫️', desc: 'Reifnebel' },
  51: { emoji: '🌧️', desc: 'Nieselregen' },
  53: { emoji: '🌧️', desc: 'Nieselregen' },
  55: { emoji: '🌧️', desc: 'Nieselregen' },
  56: { emoji: '🌧️', desc: 'Gefrierender Niesel' },
  57: { emoji: '🌧️', desc: 'Gefrierender Niesel' },
  61: { emoji: '🌧️', desc: 'Regen' },
  63: { emoji: '🌧️', desc: 'Regen' },
  65: { emoji: '🌧️', desc: 'Starker Regen' },
  66: { emoji: '🌧️', desc: 'Gefrierender Regen' },
  67: { emoji: '🌧️', desc: 'Gefrierender Regen' },
  71: { emoji: '❄️', desc: 'Schnee' },
  73: { emoji: '❄️', desc: 'Schnee' },
  75: { emoji: '❄️', desc: 'Starker Schneefall' },
  77: { emoji: '❄️', desc: 'Schneegriesel' },
  80: { emoji: '🌧️', desc: 'Regenschauer' },
  81: { emoji: '🌧️', desc: 'Regenschauer' },
  82: { emoji: '🌧️', desc: 'Heftige Schauer' },
  85: { emoji: '❄️', desc: 'Schneeschauer' },
  86: { emoji: '❄️', desc: 'Schneeschauer' },
  95: { emoji: '⛈️', desc: 'Gewitter' },
  96: { emoji: '⛈️', desc: 'Gewitter mit Hagel' },
  99: { emoji: '⛈️', desc: 'Schweres Gewitter' },
}

function getWeatherInfo(code: number) {
  return WEATHER_CODE_MAP[code] ?? { emoji: '🌡️', desc: 'Unbekannt' }
}

function fmtDay(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-DE', { weekday: 'short' })
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showLocationInput, setShowLocationInput] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)
  const cacheRef = useRef<{ data: WeatherData; ts: number } | null>(null)

  // ── Read stored location from localStorage ──
  const storedLocation = useMemo(() => {
    const lat = localStorage.getItem('weather_lat')
    const lon = localStorage.getItem('weather_lon')
    const name = localStorage.getItem('weather_name')
    if (lat && lon && name) return { lat: parseFloat(lat), lon: parseFloat(lon), name }
    return null
  }, [])

  // ── Fetch weather data ──
  const fetchWeather = useCallback(async (lat: number, lon: number, name: string) => {
    // Check 10-minute cache
    if (cacheRef.current && Date.now() - cacheRef.current.ts < 10 * 60 * 1000) {
      setWeather(cacheRef.current.data)
      return
    }

    setLoading(true)
    setError('')
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Wetterdaten konnten nicht geladen werden')
      const data = await res.json()

      const wd: WeatherData = {
        current: {
          temperature: data.current.temperature_2m,
          weatherCode: data.current.weather_code,
        },
        daily: data.daily.time.slice(1, 4).map((t: string, i: number) => ({
          date: t,
          weatherCode: data.daily.weather_code[i + 1],
          tempMax: data.daily.temperature_2m_max[i + 1],
          tempMin: data.daily.temperature_2m_min[i + 1],
        })),
        locationName: name,
      }

      cacheRef.current = { data: wd, ts: Date.now() }
      setWeather(wd)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Fetch when location is available ──
  useEffect(() => {
    if (storedLocation) {
      fetchWeather(storedLocation.lat, storedLocation.lon, storedLocation.name)
    }
  }, [storedLocation, fetchWeather])

  // ── Geocode city name ──
  const handleGeocode = async () => {
    const query = locationQuery.trim()
    if (!query) return
    setGeoLoading(true)
    setError('')
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`,
      )
      if (!res.ok) throw new Error('Ort nicht gefunden')
      const data = await res.json()
      if (!data.results || data.results.length === 0) {
        setError(`"${query}" nicht gefunden`)
        return
      }
      const result: GeoResult = {
        lat: data.results[0].latitude,
        lon: data.results[0].longitude,
        name: data.results[0].name,
        country: data.results[0].country,
      }
      const displayName = result.country
        ? `${result.name}, ${result.country}`
        : result.name
      localStorage.setItem('weather_lat', String(result.lat))
      localStorage.setItem('weather_lon', String(result.lon))
      localStorage.setItem('weather_name', displayName)
      cacheRef.current = null // force refetch
      setShowLocationInput(false)
      setLocationQuery('')
      fetchWeather(result.lat, result.lon, displayName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Suche')
    } finally {
      setGeoLoading(false)
    }
  }

  // ── Memoized current weather info ──
  const currentInfo = useMemo(() => {
    if (!weather) return null
    return getWeatherInfo(weather.current.weatherCode)
  }, [weather])

  // ── No location set: prompt ──
  if (!storedLocation && !showLocationInput) {
    return (
      <div className="weather-widget weather-widget-prompt">
        <div className="weather-prompt-text">
          <span className="weather-emoji-large">🌤️</span>
          <p>Tippe deinen Urlaubsort ein, um das Wetter zu sehen</p>
        </div>
        <button
          className="weather-location-btn"
          onClick={() => setShowLocationInput(true)}
        >
          Ort ändern
        </button>
      </div>
    )
  }

  return (
    <div className="weather-widget">
      {/* Location input overlay */}
      {showLocationInput && (
        <div className="weather-location-form">
          <input
            className="weather-location-input"
            type="text"
            placeholder="Stadtname eingeben…"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGeocode()}
            autoFocus
          />
          <button
            className="weather-geo-btn"
            onClick={handleGeocode}
            disabled={geoLoading || !locationQuery.trim()}
          >
            {geoLoading ? '…' : 'Suchen'}
          </button>
          <button
            className="weather-geo-cancel"
            onClick={() => { setShowLocationInput(false); setLocationQuery(''); setError('') }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error message */}
      {error && <p className="weather-error">{error}</p>}

      {/* Loading state */}
      {loading && !weather && <p className="weather-loading">Lädt Wetter…</p>}

      {/* Weather display */}
      {weather && currentInfo && !showLocationInput && (
        <>
          <div className="weather-current">
            <div className="weather-current-main">
              <span className="weather-emoji-large">{currentInfo.emoji}</span>
              <div className="weather-temp-info">
                <span className="weather-temp">
                  {Math.round(weather.current.temperature)}°C
                </span>
                <span className="weather-desc">{currentInfo.desc}</span>
              </div>
            </div>
            <div className="weather-location-row">
              <span className="weather-location-name">{weather.locationName}</span>
              <button
                className="weather-change-btn"
                onClick={() => setShowLocationInput(true)}
              >
                Ort ändern
              </button>
            </div>
          </div>

          {weather.daily.length > 0 && (
            <div className="weather-forecast">
              {weather.daily.map((day, i) => {
                const info = getWeatherInfo(day.weatherCode)
                return (
                  <div key={i} className="weather-forecast-day">
                    <span className="weather-forecast-dayname">
                      {fmtDay(day.date)}
                    </span>
                    <span className="weather-forecast-emoji">{info.emoji}</span>
                    <span className="weather-forecast-temps">
                      <span className="weather-temp-max">{Math.round(day.tempMax)}°</span>
                      <span className="weather-temp-min">{Math.round(day.tempMin)}°</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}