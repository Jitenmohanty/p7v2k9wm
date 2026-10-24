from datetime import date, time

DECISION_START = date(2026, 1, 1)
DECISION_END = date(2026, 1, 31)
DEFAULT_CUTOFF = time(9, 20)
LOCAL_TIMEZONE = "Europe/London"
ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
CACHE_TTL_SECONDS = 900
EXPECTED_INTERVALS_PER_DAY = 48
