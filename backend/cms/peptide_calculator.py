"""Peptide syringe math — same formulas as Great Life's peptide calculator.

MG vials work with mg or mcg doses:
  ml = (dose_mcg / (vial_mg * 1000)) * water_ml

IU vials work with IU doses:
  ml = (dose_iu / vial_iu) * water_ml

Mixing MG with IU (or IU with mg/mcg) is incompatible; there is no conversion factor.
"""

from __future__ import annotations

from typing import Literal

VialUnit = Literal["mg", "iu"]
DoseUnit = Literal["mcg", "mg", "iu"]


def compute_syringe_ml(
    vial_unit: VialUnit,
    vial_amt: float,
    water_ml: float,
    dose_unit: DoseUnit,
    dose_amt: float,
) -> tuple[float | None, str | None]:
    if water_ml <= 0 or vial_amt <= 0 or dose_amt <= 0:
        return None, "incomplete"

    if vial_unit == "mg":
        if dose_unit == "iu":
            return None, "incompatible"
        total_mcg = vial_amt * 1000
        dose_mcg = dose_amt * 1000 if dose_unit == "mg" else dose_amt
        return (dose_mcg / total_mcg) * water_ml, None

    if vial_unit == "iu":
        if dose_unit != "iu":
            return None, "incompatible"
        return (dose_amt / vial_amt) * water_ml, None

    return None, "incomplete"


def format_syringe_ml(ml: float) -> str:
    return f"{ml:.3f}"
