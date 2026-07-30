import json
import pandas as pd

path = r"C:\Users\mkt-tj-ai\Downloads\Copia de CITAS 25  26.xlsx"
df = pd.read_excel(path, sheet_name="CITAS BDC")

def norm(series):
    return series.fillna("").astype(str).str.strip().str.upper()

def excel_dates(series):
    def convert(value):
        if pd.isna(value):
            return pd.NaT
        if isinstance(value, (int, float)):
            return pd.Timestamp("1899-12-30") + pd.to_timedelta(value, unit="D")
        return pd.to_datetime(value, errors="coerce")
    return series.map(convert)

date_lead = excel_dates(df["Fecha Lead"])
date_cita = excel_dates(df["Fecha cita"])
lead_id = norm(df["N° Lead"])
phone = norm(df["Teléfono"]).str.replace(r"\D", "", regex=True)
confirm = norm(df["Confirmación"])
attended = norm(df["Asistió"])
source = norm(df["Fuente"])
branch = norm(df["Sucursal"])
apv = norm(df["APV"])
manager = norm(df["Gerente"])

nonblank_ids = lead_id[lead_id != ""]
nonblank_phones = phone[phone != ""]

summary = {
    "rows": int(len(df)),
    "columns": list(df.columns),
    "date_lead_min": str(date_lead.min().date()) if date_lead.notna().any() else None,
    "date_lead_max": str(date_lead.max().date()) if date_lead.notna().any() else None,
    "date_cita_min": str(date_cita.min().date()) if date_cita.notna().any() else None,
    "date_cita_max": str(date_cita.max().date()) if date_cita.notna().any() else None,
    "lead_id_present": int((lead_id != "").sum()),
    "lead_id_missing": int((lead_id == "").sum()),
    "lead_id_unique": int(nonblank_ids.nunique()),
    "lead_id_duplicate_rows": int(nonblank_ids.duplicated(keep=False).sum()),
    "phone_present": int((phone != "").sum()),
    "phone_unique": int(nonblank_phones.nunique()),
    "phone_duplicate_rows": int(nonblank_phones.duplicated(keep=False).sum()),
    "unique_apv": int(apv[apv != ""].nunique()),
    "unique_managers": int(manager[manager != ""].nunique()),
    "unique_branches": int(branch[branch != ""].nunique()),
    "confirmation_nonblank": int((confirm != "").sum()),
    "attended_nonblank": int((attended != "").sum()),
    "sources": source.value_counts().head(20).to_dict(),
    "confirmations": confirm.value_counts().head(20).to_dict(),
    "attendance": attended.value_counts().head(20).to_dict(),
    "branches": branch.value_counts().head(30).to_dict(),
    "lead_years": date_lead.dt.year.value_counts().sort_index().to_dict(),
    "appointment_years": date_cita.dt.year.value_counts().sort_index().to_dict(),
}

out = r"C:\Users\mkt-tj-ai\Documents\FUNNEL\vercel-supabase\outputs\bdc-drive-analysis-20260729\profile.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(summary, f, ensure_ascii=False, indent=2, default=lambda x: int(x))
print(json.dumps(summary, ensure_ascii=False, indent=2, default=lambda x: int(x)))
