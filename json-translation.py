from pathlib import Path
import csv
import io
import json
import re


section_descriptions = {
    "Project detail": "Project detail contains the core information about your project. Use the filters below to show questions relevant to your project.",
    "Discovery": "Discovery is the project research and scoping phase. You are understanding the problem that needs to be solved and the opportunities for addressing them using data and AI. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">discovery phase</a> in a new tab.<br><br>",
    "Alpha": "Alpha is the initial solution development phase. You are building prototypes to test your ideas and assumptions, and to gather feedback from users. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">alpha phase</a> in a new tab.<br><br>",
    "Beta": "Beta is the phase where you are building the solution that best solves your problem. You are refining your solution based on user feedback and preparing for launch. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-beta-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">beta phase</a> in a new tab.<br><br>",
    "Live": "Live is the phase where your solution is available to users. You are monitoring performance and gathering feedback to inform future improvements. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-live-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">live phase</a> in a new tab.<br><br>",
}


def csv_to_survey(
    rows,
    pages=None,
    page_name="page1",
    page_title="Discovery",
    page_description="Phase 1 of your project.",
    section_descriptions=section_descriptions,
):
    """Translate CSV schema rows into a SurveyJS-compatible survey definition."""
    def rows_for_section(section):
        return [
            row for row in rows
            if row.get("Section", "").strip().casefold() == section.casefold()
        ]

    if pages is None:
        sections = []
        for row in rows:
            section = row.get("Section", "").strip()
            if section and section.casefold() not in {item.casefold() for item in sections}:
                sections.append(section)

        if sections:
            pages = [
                {
                    "section": section,
                    "name": f"page{index}",
                    "title": section,
                    "description": section_descriptions.get(section),
                }
                for index, section in enumerate(sections, start=1)
            ]
        else:
            pages = [{
                "section": None,
                "name": page_name,
                "title": page_title,
                "description": page_description,
            }]

    def rows_for_page(page):
        section = page.get("section")
        if section is None:
            return rows
        return rows_for_section(section)

    def elements_for_rows(page_rows):
        elements = []
        text_or_suggestion_groups = set()

        for row in page_rows:
            reference = row["Reference"].strip()
            field_text = row["Field text"].strip()
            component_type = row["Component type"].strip().lower()
            trigger = row["Trigger"].strip()
            if trigger.lower() == "none":
                trigger = ""

            if not reference or not field_text:
                continue

            group_match = re.match(r"\d+", reference)
            field_group = group_match.group() if group_match else None
            is_text_or_suggestion = "T" in reference or reference.endswith("S")
            survey_type = {"radios": "radiogroup", "suggestion": "expression", "text": "comment", "short text": "text", "multiselect": "checkbox"}.get(
                component_type, component_type
            )
            line_break_needed = reference.isdigit() or survey_type == "comment"
            if is_text_or_suggestion and field_group not in text_or_suggestion_groups:
                line_break_needed = True
                text_or_suggestion_groups.add(field_group)

            element = {
                "type": survey_type,
                "name": reference,
                "startWithNewLine": line_break_needed,
            }

            if row.get("Section", "").strip().casefold() == "project detail":
                element["title"] = field_text
            elif reference.endswith("S"):
                element["title"] = f"{reference[:-1]} {field_text}".rstrip()
            elif "T" in reference:
                element["title"] = field_text
            else:
                element["title"] = f"{reference}. {field_text}"

            trigger_parts = [
                part.strip()
                for part in re.split(r"\s+OR\s+", trigger, flags=re.IGNORECASE)
            ]
            trigger_match = None
            if trigger_parts and trigger_parts[0]:
                trigger_match = re.fullmatch(
                    r"(.+?)(<>|=|-)(.+)", trigger_parts[0]
                )
                if trigger_match:
                    question, operator, first_value = (
                        part.strip() for part in trigger_match.groups()
                    )
                    operator = "=" if operator == "-" else operator
                    values = [first_value] + [
                        part for part in trigger_parts[1:] if part
                    ]
                    source_row = next(
                        (
                            candidate for candidate in page_rows
                            if candidate["Reference"].strip() == question
                        ),
                        None,
                    )
                    if source_row is None:
                        current_index = next(
                            index for index, candidate in enumerate(rows)
                            if candidate is row
                        )
                        source_row = next(
                            (
                                candidate for candidate in reversed(rows[:current_index])
                                if candidate["Reference"].strip() == question
                            ),
                            None,
                        )
                    if source_row and source_row.get("Component type", "").strip().casefold() != "radios":
                        source_options = {
                            option: source_row.get(option, "").strip()
                            for option in ("Option a", "Option b", "Option c", "Option d", "Option e")
                            if source_row.get(option, "").strip()
                        }
                        values = [
                            next(
                                (
                                    option for option, label in source_options.items()
                                    if label.casefold() == value.casefold()
                                ),
                                value,
                            )
                            for value in values
                        ]
                    element["visibleIf"] = " or ".join(
                        f"{{{question}}} {operator} '{value}'"
                        for value in values
                    )

            if element["type"] in ("radiogroup", "checkbox"):
                option_labels = {
                    option: row.get(option, "").strip()
                    for option in ("Option a", "Option b", "Option c", "Option d", "Option e")
                    if row.get(option, "").strip()
                }
                if element["type"] == "checkbox":
                    element["choices"] = [
                        {"value": option, "text": label}
                        for option, label in option_labels.items()
                    ]
                else:
                    element["choices"] = [
                        label for label in option_labels.values()
                    ]
                    element["allowClear"] = True
                    element["isRequired"] = True
                    if trigger_match and operator == "=":
                        element["resetValueIf"] = " and ".join(
                            f"{{{question}}} <> '{value}'"
                            for value in values
                        )

            elements.append(element)

        return elements

    return {
        "pages": [
            {
                "name": page["name"],
                "title": page["title"],
                "description": page["description"],
                "elements": elements_for_rows(rows_for_page(page)),
            }
            for page in pages
        ],
        "headerView": "advanced",
    }


def main():
    project_dir = Path(__file__).resolve().parent
    csv_path = project_dir / "daief-schema-eg.csv"
    output_path = project_dir / "translated-survey.json"

    csv_bytes = csv_path.read_bytes()
    try:
        csv_text = csv_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        csv_text = csv_bytes.decode("cp1252")
    schema = list(csv.DictReader(io.StringIO(csv_text)))

    for row in schema:
        for field, value in row.items():
            if value:
                row[field] = (
                    value.replace("�s", "'s")
                    .replace("�re", "'re")
                    .replace("�ve", "'ve")
                    .replace("�d", "'d")
                    .replace("�ll", "'ll")
                    .replace("�", "")
                    .replace("Õ", "'")
                    .replace("Ê", "")
                )

    translated_survey = csv_to_survey(schema)

    empty_pages = [page["name"] for page in translated_survey["pages"] if not page["elements"]]
    if empty_pages:
        raise ValueError(f"No elements generated for: {', '.join(empty_pages)}")

    with output_path.open("w", encoding="utf-8") as output_file:
        json.dump(translated_survey, output_file, ensure_ascii=False, indent=2)

csv_path = Path("daief-schema-eg.csv")
survey_path = Path("daief-survey.json")

csv_bytes = csv_path.read_bytes()
try:
    csv_text = csv_bytes.decode("utf-8-sig")
except UnicodeDecodeError:
    csv_text = csv_bytes.decode("cp1252")
schema = list(csv.DictReader(io.StringIO(csv_text)))

for row in schema:
    for field, value in row.items():
        if value:
            row[field] = (
                value.replace("�s", "'s")
                .replace("�re", "'re")
                .replace("�ve", "'ve")
                .replace("�d", "'d")
                .replace("�ll", "'ll")
                .replace("�", "")
                .replace("Õ", "'")
                .replace("Ê", "")
            )




if __name__ == "__main__":

    with survey_path.open(encoding="utf-8") as survey_file:
        survey = json.load(survey_file)

    translated_survey = csv_to_survey(schema)

    empty_pages = [page["name"] for page in translated_survey["pages"] if not page["elements"]]
    if empty_pages:
        raise ValueError(f"No elements generated for: {', '.join(empty_pages)}")

    output_path = Path("translated-survey.json")
    with output_path.open("w", encoding="utf-8") as output_file:
        json.dump(translated_survey, output_file, ensure_ascii=False, indent=2)