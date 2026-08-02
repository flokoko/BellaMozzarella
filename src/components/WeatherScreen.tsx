import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './WeatherScreen.css'

interface WeatherData {
  current: {
    temperature: number
    apparentTemperature: number
    weatherCode: number
    humidity: number
    windSpeed: number
    uvIndex: number
    pressure: number
    visibility: number
    time: string
  }
  hourly: {
    time: string[]
    temperature: number[]
    weatherCode: number[]
    precipitationProbability: number[]
    windSpeed: number[]
  }
  daily: {
    time: string[]
    weatherCode: number[]
    tempMax: number[]
    tempMin: number[]
    precipitationProbabilityMax: number[]
    windSpeedMax: number[]
    sunrise: string[]
    sunset: string[]
  }
  locationName: string
}

interface GeoResult {
  lat: number
  lon: number
  name: string
  country?: string
}

interface RadarFrame {
  time: number
  path: string
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

function fmtDayLong(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-DE', { weekday: 'long' })
}

function fmtTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function fmtHour(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('de-DE', { hour: '2-digit' }) + ' h'
}

function fmtRadarTime(ts: number) {
  const d = new Date(ts * 1000)
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

/** Component that updates the map view when coordinates change */
function MapUpdater({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lon], 9)
  }, [map, lat, lon])
  return null
}

export default function WeatherScreen() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showLocationInput, setShowLocationInput] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [geoLoading, setGeoLoading] = useState(false)
  const cacheRef = useRef<{ data: WeatherData; ts: number } | null>(null)

  // ── Radar state ──
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([])
  const [radarHost, setRadarHost] = useState('')
  const [radarPlaying, setRadarPlaying] = useState(true)
  const [radarIndex, setRadarIndex] = useState(0)
  const radarIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Read stored location from localStorage ──
  const storedLocation = useMemo(() => {
    const lat = localStorage.getItem('weather_lat')
    const lon = localStorage.getItem('weather_lon')
    const name = localStorage.getItem('weather_name')
    if (lat && lon && name) return { lat: parseFloat(lat), lon: parseFloat(lon), name }
    return null
  }, [])

  // ── Fetch weather data (rich API for screen) ──
  const fetchWeather = useCallback(async (lat: number, lon: number, name: string) => {
    if (cacheRef.current && Date.now() - cacheRef.current.ts < 10 * 60 * 1000) {
      setWeather(cacheRef.current.data)
      return
    }

    setLoading(true)
    setError('')
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index,pressure_msl,visibility&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset&timezone=auto&forecast_days=7`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Wetterdaten konnten nicht geladen werden')
      const data = await res.json()

      const wd: WeatherData = {
        current: {
          temperature: data.current.temperature_2m,
          apparentTemperature: data.current.apparent_temperature,
          weatherCode: data.current.weather_code,
          humidity: data.current.relative_humidity_2m,
          windSpeed: data.current.wind_speed_10m,
          uvIndex: data.current.uv_index,
          pressure: data.current.pressure_msl,
          visibility: data.current.visibility,
          time: data.current.time,
        },
        hourly: {
          time: data.hourly.time,
          temperature: data.hourly.temperature_2m,
          weatherCode: data.hourly.weather_code,
          precipitationProbability: data.hourly.precipitation_probability,
          windSpeed: data.hourly.wind_speed_10m,
        },
        daily: {
          time: data.daily.time,
          weatherCode: data.daily.weather_code,
          tempMax: data.daily.temperature_2m_max,
          tempMin: data.daily.temperature_2m_min,
          precipitationProbabilityMax: data.daily.precipitation_probability_max,
          windSpeedMax: data.daily.wind_speed_10m_max,
          sunrise: data.daily.sunrise,
          sunset: data.daily.sunset,
        },
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

  // ── Fetch radar data ──
  useEffect(() => {
    let cancelled = false
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const past: RadarFrame[] = (data.radar?.past ?? []) as RadarFrame[]
        const host = data.host as string
        setRadarHost(host)
        setRadarFrames(past)
        setRadarIndex(past.length - 1)
      })
      .catch(() => { /* radar silently fails */ })
    return () => { cancelled = true }
  }, [])

  // ── Radar animation interval ──
  useEffect(() => {
    if (radarPlaying && radarFrames.length > 0) {
      radarIntervalRef.current = setInterval(() => {
        setRadarIndex(prev => (prev + 1) % radarFrames.length)
      }, 500)
    }
    return () => {
      if (radarIntervalRef.current) {
        clearInterval(radarIntervalRef.current)
        radarIntervalRef.current = null
      }
    }
  }, [radarPlaying, radarFrames.length])

  const toggleRadar = () => {
    navigator.vibrate?.(8)
    setRadarPlaying(prev => !prev)
  }

  const handleRadarSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = Number(e.target.value)
    setRadarIndex(idx)
    setRadarPlaying(false)
  }

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
      cacheRef.current = null
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

  // ── Hourly forecast: next 24 hours from current time ──
  const hourlyForecast = useMemo(() => {
    if (!weather) return []
    const now = new Date()
    const currentHour = now.toISOString().slice(0, 13)
    const startIndex = weather.hourly.time.findIndex((t: string) => t.slice(0, 13) >= currentHour)
    const start = startIndex >= 0 ? startIndex : 0
    return weather.hourly.time.slice(start, start + 24).map((t: string, i: number) => ({
      time: t,
      temperature: weather.hourly.temperature[start + i],
      weatherCode: weather.hourly.weatherCode[start + i],
      precipitationProbability: weather.hourly.precipitationProbability[start + i],
      windSpeed: weather.hourly.windSpeed[start + i],
    }))
  }, [weather])

  // ── Daily forecast: 7 days ──
  const dailyForecast = useMemo(() => {
    if (!weather) return []
    return weather.daily.time.map((t: string, i: number) => ({
      date: t,
      weatherCode: weather.daily.weatherCode[i],
      tempMax: weather.daily.tempMax[i],
      tempMin: weather.daily.tempMin[i],
      precipitationProbability: weather.daily.precipitationProbabilityMax[i],
      windSpeed: weather.daily.windSpeedMax[i],
      sunrise: weather.daily.sunrise[i],
      sunset: weather.daily.sunset[i],
    }))
  }, [weather])

  // ── UV Index description ──
  const uvDesc = useMemo(() => {
    if (!weather) return ''
    const uv = weather.current.uvIndex
    if (uv <= 2) return 'Niedrig'
    if (uv <= 5) return 'Mäßig'
    if (uv <= 7) return 'Hoch'
    if (uv <= 10) return 'Sehr hoch'
    return 'Extrem'
  }, [weather])

  // ── No location set: prompt ──
  if (!storedLocation && !showLocationInput) {
    return (
      <div className="weather-screen weather-screen-prompt">
        <div className="weather-screen-prompt-content">
          <span className="weather-screen-prompt-emoji">🌤️</span>
          <h2 className="weather-screen-prompt-title">Wetter-Übersicht</h2>
          <p className="weather-screen-prompt-text">
            Tippe deinen Urlaubsort ein, um das Wetter zu sehen
          </p>
          <button
            className="weather-screen-set-btn"
            onClick={() => { navigator.vibrate?.(8); setShowLocationInput(true) }}
          >
            Ort festlegen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="weather-screen">
      {/* ── Location input overlay ── */}
      {showLocationInput && (
        <div className="weather-screen-location-form">
          <input
            className="weather-screen-location-input"
            type="text"
            placeholder="Stadtname eingeben…"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGeocode()}
            autoFocus
          />
          <button
            className="weather-screen-geo-btn"
            onClick={() => { navigator.vibrate?.(8); handleGeocode() }}
            disabled={geoLoading || !locationQuery.trim()}
          >
            {geoLoading ? '…' : 'Suchen'}
          </button>
          <button
            className="weather-screen-geo-cancel"
            onClick={() => { navigator.vibrate?.(8); setShowLocationInput(false); setLocationQuery(''); setError('') }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Error / Loading ── */}
      {error && <p className="weather-screen-error">{error}</p>}
      {loading && !weather && (
        <div className="weather-screen-loading">
          <span className="weather-screen-loading-emoji">🌦️</span>
          <p>Lädt Wetterdaten…</p>
        </div>
      )}

      {/* ── Weather content ── */}
      {weather && currentInfo && !showLocationInput && (
        <>
          {/* ── Hero section ── */}
          <div className="weather-hero">
            <div className="weather-hero-top">
              <div className="weather-hero-emoji">{currentInfo.emoji}</div>
              <div className="weather-hero-temp">
                {Math.round(weather.current.temperature)}°C
              </div>
            </div>
            <div className="weather-hero-desc">{currentInfo.desc}</div>
            <div className="weather-hero-feels">
              Gefühlt {Math.round(weather.current.apparentTemperature)}°C
            </div>
            <div className="weather-hero-location">📍 {weather.locationName}</div>
            <div className="weather-hero-updated">
              Aktualisiert: {fmtTime(weather.current.time)}
            </div>
            <button
              className="weather-screen-change-btn"
              onClick={() => { navigator.vibrate?.(8); setShowLocationInput(true) }}
            >
              Ort ändern
            </button>
          </div>

          {/* ── Hourly forecast ── */}
          <div className="weather-section">
            <h3 className="weather-section-title">⏱️ Stündlich (24h)</h3>
            <div className="weather-hourly-scroll">
              {hourlyForecast.map((hour, i) => {
                const info = getWeatherInfo(hour.weatherCode)
                return (
                  <div key={i} className="weather-hourly-card">
                    <span className="weather-hourly-time">{fmtHour(hour.time)}</span>
                    <span className="weather-hourly-emoji">{info.emoji}</span>
                    <span className="weather-hourly-temp">{Math.round(hour.temperature)}°</span>
                    <span className="weather-hourly-rain">
                      💧 {hour.precipitationProbability}%
                    </span>
                    <span className="weather-hourly-wind">
                      💨 {Math.round(hour.windSpeed)} km/h
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Rain Radar ── */}
          {storedLocation && radarFrames.length > 0 && (
            <div className="weather-section">
              <div className="weather-radar-header">
                <h3 className="weather-section-title" style={{ margin: 0 }}>📡 Regenradar</h3>
                <div className="weather-radar-controls">
                  <span className="weather-radar-time">
                    {fmtRadarTime(radarFrames[radarIndex]?.time ?? 0)}
                  </span>
                  <button
                    className="weather-radar-play-btn"
                    onClick={toggleRadar}
                    aria-label={radarPlaying ? 'Pause' : 'Play'}
                  >
                    {radarPlaying ? '⏸' : '▶️'}
                  </button>
                </div>
              </div>
              <div className="weather-radar-map">
                <MapContainer
                  center={[storedLocation.lat, storedLocation.lon]}
                  zoom={9}
                  maxZoom={12}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={true}
                  scrollWheelZoom={true}
                  dragging={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    maxZoom={12}
                  />
                  {radarHost && radarFrames[radarIndex] && (
                    <TileLayer
                      key={radarFrames[radarIndex].path}
                      url={`${radarHost}${radarFrames[radarIndex].path}/256/{z}/{x}/{y}/2/1.png`}
                      opacity={0.55}
                    />
                  )}
                  <CircleMarker
                    center={[storedLocation.lat, storedLocation.lon]}
                    radius={10}
                    pathOptions={{ color: '#ce2b37', fillColor: '#ce2b37', fillOpacity: 0.8, weight: 2 }}
                  />
                  <MapUpdater lat={storedLocation.lat} lon={storedLocation.lon} />
                </MapContainer>
              </div>
              <div className="weather-radar-timeline">
                <input
                  type="range"
                  className="weather-radar-slider"
                  min={0}
                  max={radarFrames.length - 1}
                  value={radarIndex}
                  onChange={handleRadarSlider}
                />
                <div className="weather-radar-timeline-labels">
                  <span className="weather-radar-timeline-label">
                    {fmtRadarTime(radarFrames[0]?.time ?? 0)}
                  </span>
                  <span className="weather-radar-timeline-label">
                    {fmtRadarTime(radarFrames[radarFrames.length - 1]?.time ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Daily forecast ── */}
          <div className="weather-section">
            <h3 className="weather-section-title">📅 7-Tage-Vorhersage</h3>
            <div className="weather-daily-list">
              {dailyForecast.map((day, i) => {
                const info = getWeatherInfo(day.weatherCode)
                return (
                  <div key={i} className="weather-daily-card">
                    <div className="weather-daily-day">
                      <span className="weather-daily-dayname">
                        {i === 0 ? 'Heute' : i === 1 ? 'Morgen' : fmtDayLong(day.date)}
                      </span>
                      <span className="weather-daily-sub">{fmtDay(day.date)}</span>
                    </div>
                    <div className="weather-daily-emoji">{info.emoji}</div>
                    <div className="weather-daily-desc">{info.desc}</div>
                    <div className="weather-daily-temps">
                      <span className="weather-daily-max">{Math.round(day.tempMax)}°</span>
                      <span className="weather-daily-min">{Math.round(day.tempMin)}°</span>
                    </div>
                    <div className="weather-daily-rain">💧 {day.precipitationProbability}%</div>
                    <div className="weather-daily-wind">💨 {Math.round(day.windSpeed)} km/h</div>
                    <div className="weather-daily-sun">
                      🌅 {fmtTime(day.sunrise)} · 🌇 {fmtTime(day.sunset)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Details grid ── */}
          <div className="weather-section">
            <h3 className="weather-section-title">📊 Details</h3>
            <div className="weather-details-grid">
              <div className="weather-detail-card">
                <span className="weather-detail-label">Luftfeuchtigkeit</span>
                <span className="weather-detail-value">{weather.current.humidity}%</span>
              </div>
              <div className="weather-detail-card">
                <span className="weather-detail-label">Windgeschwindigkeit</span>
                <span className="weather-detail-value">{Math.round(weather.current.windSpeed)} km/h</span>
              </div>
              <div className="weather-detail-card">
                <span className="weather-detail-label">UV-Index</span>
                <span className="weather-detail-value">
                  {weather.current.uvIndex.toFixed(1)} · {uvDesc}
                </span>
              </div>
              <div className="weather-detail-card">
                <span className="weather-detail-label">Sichtweite</span>
                <span className="weather-detail-value">{Math.round(weather.current.visibility / 1000)} km</span>
              </div>
              <div className="weather-detail-card">
                <span className="weather-detail-label">Luftdruck</span>
                <span className="weather-detail-value">{Math.round(weather.current.pressure)} hPa</span>
              </div>
              <div className="weather-detail-card">
                <span className="weather-detail-label">Gefühlt</span>
                <span className="weather-detail-value">{Math.round(weather.current.apparentTemperature)}°C</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
