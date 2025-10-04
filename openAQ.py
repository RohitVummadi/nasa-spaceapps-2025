from openaq import OpenAQ
from datetime import datetime

important = {("pm25", "µg/m³"), ("o3", "ppm"), ("co2", "ppm"), ("no2", "ppm"), ("so2", "ppm")}  # track by (parameter.name, units)
API_KEY = "ab1d15d101b5a0a66390a4ea00c19941acb4b4e316e25c8bacda649d6f6e7003"
coords = (40.730610, -73.935242)  # (lat, lon)

client = OpenAQ(api_key=API_KEY)

def fmt_when(dt_obj, prefer="local"):
    """Return an ISO-8601 string from various OpenAQ datetime shapes."""
    if dt_obj is None:
        return "?"

    # Case 1: has .local/.utc attributes
    for key in (prefer, "utc"):
        v = getattr(dt_obj, key, None)
        if v:
            return v.isoformat() if hasattr(v, "isoformat") else str(v)

    # Case 2: plain datetime
    if isinstance(dt_obj, datetime):
        return dt_obj.isoformat()

    # Case 3: dict-like
    if isinstance(dt_obj, dict):
        for key in (prefer, "utc", "date", "datetime"):
            v = dt_obj.get(key)
            if v:
                return v.isoformat() if hasattr(v, "isoformat") else str(v)

    # Case 4: string fallback
    return str(dt_obj)


try:
    output = client.locations.list(
        coordinates=coords,
        radius=10000,
        limit=20
    )

    for loc in output.results:
        print(f"\n📍 Location: {loc.name} (ID: {loc.id})")
        print(f"   Coordinates: {loc.coordinates}")

        sensors = getattr(loc, "sensors", None) or []
        if not sensors:
            print("   No sensors available")
            continue

        sensors_by_id = {s.id: s for s in sensors}

        # Hit the Latest endpoint
        latest = client.locations.latest(locations_id=loc.id)

        shown_any = False
        for r in latest.results:
            # Handle sensors_id vs sensor_id
            sid = getattr(r, "sensors_id", None) or getattr(r, "sensor_id", None)
            s = sensors_by_id.get(sid)
            if not s:
                continue

            p = s.parameter  # parameter metadata (has .name, .display_name, .units)

            # Filter on important (parameter name + units)
            if (getattr(p, "name", ""), getattr(p, "units", "")) not in important:
                continue

            when = fmt_when(r.datetime)
            val = r.value
            units = getattr(p, "units", None) or "(units?)"

            if not shown_any:
                print("   Latest:")
                shown_any = True

            print(f"     - {p.display_name} ({p.name}): {val} {units} @ {when}")

        if not shown_any:
            print("   (no latest values for your selected sensors)")

except Exception as e:
    print("OpenAQ error:", e)

finally:
    client.close()
