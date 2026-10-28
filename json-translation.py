from pathlib import Path
import json
import re
import yaml

section_descriptions = {
    "Project Detail": "Provide the key information about your project and change the questions you see using filters.",
    "Discovery": "Discovery is the project research and scoping phase. You are understanding the problem that needs to be solved and the opportunities for addressing them using data and AI. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">discovery phase</a> in a new tab.<br><br>",    
    "Alpha": "Alpha is the initial solution development phase. You are building prototypes to test your ideas and assumptions, and to gather feedback from users. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">alpha phase</a> in a new tab.<br><br>",
    "Beta": "Beta is the phase where you are building the solution that best solves your problem. You are refining your solution based on user feedback and preparing for launch. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-beta-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">beta phase</a> in a new tab.<br><br>",
    "Live": "Live is the phase where your solution is available to users. You are monitoring performance and gathering feedback to inform future improvements. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-live-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">live phase</a> in a new tab.<br><br>",
}


def read_schema_yaml(yaml_path):
    """Read grouped survey content from YAML and normalize it into schema rows."""
    try:
        with yaml_path.open(encoding="utf-8") as yaml_file:
            content = yaml.safe_load(yaml_file)
    except yaml.YAMLError as error:
        raise ValueError(f"Could not parse {yaml_path.name}: {error}") from error

    if not isinstance(content, dict):
        raise ValueError("The YAML root must be a mapping.")

    form_version = content.get("form_version")
    if form_version is not None and not isinstance(form_version, str):
        raise ValueError("'form_version' must be a string.")

    sections = content.get("sections")
    if not isinstance(sections, list) or not sections:
        raise ValueError("'sections' must be a non-empty list.")

    schema = []
    for section_index, section in enumerate(sections, start=1):
        location = f"sections[{section_index}]"
        if not isinstance(section, dict):
            raise ValueError(f"{location} must be a mapping.")
        name = section.get("name")
        questions = section.get("questions")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"{location}.name must be a non-empty string.")
        if not isinstance(questions, list):
            raise ValueError(f"{location}.questions must be a list.")

        for question_index, question in enumerate(questions, start=1):
            question_location = f"{location}.questions[{question_index}]"
            if not isinstance(question, dict):
                raise ValueError(f"{question_location} must be a mapping.")

            for key in ("reference", "field_text", "component_type"):
                if not isinstance(question.get(key), str):
                    raise ValueError(
                        f"{question_location}.{key} must be a string."
                    )

            options = question.get("options", {})
            if not isinstance(options, dict):
                raise ValueError(f"{question_location}.options must be a mapping.")

            row = {
                "Section": name,
                "Reference": question["reference"],
                "Trigger": question.get("trigger", ""),
                "Field text": question["field_text"],
                "Component type": question["component_type"],
                "DAIEF themes": question.get("daief_themes", ""),
                "Field text hyperlinks": question.get(
                    "field_text_hyperlinks", ""
                ),
                "Hint text": question.get("hint_text", ""),
            }
            for option_letter in "abcde":
                row[f"Option {option_letter}"] = options.get(option_letter, "")

            for field, value in row.items():
                if not isinstance(value, str):
                    raise ValueError(
                        f"{question_location} values must be strings "
                        f"(invalid {field!r})."
                    )
            for option_letter, value in options.items():
                if (
                    option_letter not in {"a", "b", "c", "d", "e"}
                    or not isinstance(value, str)
                ):
                    raise ValueError(
                        f"{question_location}.options keys must be a-e "
                        "with string values."
                    )

            schema.append(row)

    return form_version, schema


def add_field_text_hyperlinks(field_text, link_text):
    """Turn bracketed field-text snippets into Markdown links."""
    destinations = [
        destination.strip()
        for destination in link_text.splitlines()
        if destination.strip()
    ]
    if not destinations:
        return field_text

    anchor_index = 0

    def replace_anchor(match):
        nonlocal anchor_index
        destination = destinations[min(anchor_index, len(destinations) - 1)]
        anchor_index += 1
        return f"[{match.group(1)}]({destination})"

    return re.sub(r"\[([^\[\]]+)\](?!\()", replace_anchor, field_text)


def schema_to_survey(
    rows,
    pages=None,
    page_name="page1",
    page_title="Discovery",
    page_description="Phase 1 of your project.",
    section_descriptions=section_descriptions,
    form_version=None,
):
    """Translate schema rows into a SurveyJS-compatible survey definition."""
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
            link_text = (
                row.get("Field text link")
                or row.get("Field text hyperlinks")
                or ""
            ).strip()
            field_text = add_field_text_hyperlinks(field_text, link_text)
            component_type = row["Component type"].strip().lower()
            trigger = row["Trigger"].strip()
            if trigger.lower() == "none":
                trigger = ""

            if not reference or not field_text:
                continue

            group_match = re.match(r"\d+", reference)
            field_group = group_match.group() if group_match else None
            is_text_or_suggestion = field_group is not None and (
                "T" in reference or reference.endswith("S")
            )
            survey_type = {"radios": "radiogroup", "suggestion": "expression", "text": "comment", "short text": "text", "multiselect": "checkbox"}.get(
                component_type, component_type
            )
            is_project_detail = (
                row.get("Section", "").strip().casefold() == "project detail"
            )
            line_break_needed = (
                is_project_detail or reference.isdigit() or survey_type == "comment"
            )
            if is_text_or_suggestion and field_group not in text_or_suggestion_groups:
                line_break_needed = True
                text_or_suggestion_groups.add(field_group)

            element = {
                "type": survey_type,
                "name": reference,
                "startWithNewLine": line_break_needed,
            }

            if re.fullmatch(r"\d+", reference):
                theme_value = (
                    row.get("DAIEF theme", "").strip()
                    or row.get("DAIEF themes", "").strip()
                )
                themes = [
                    theme.strip()
                    for theme in theme_value.split(",")
                    if theme.strip() and theme.strip().casefold() not in {"n/a", "na"}
                ]
                if themes:
                    element["themes"] = themes

            if is_project_detail:
                element["title"] = field_text
            elif field_group is not None and reference.endswith("S"):
                element["title"] = f"{reference[:-1]}. {field_text}".rstrip()
            elif field_group is not None and "T" in reference:
                element["title"] = f"{reference[:-1]}. {field_text}".rstrip()
            else:
                element["title"] = f"{reference}. {field_text}"

            hint_text = row.get("Hint text", "").strip()
            if hint_text and hint_text != "0":
                element["description"] = hint_text

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

                    is_checkbox_source = (
                        source_row is not None
                        and source_row.get("Component type", "").strip().casefold()
                        == "multiselect"
                    )
                    if source_row and source_row.get("Component type", "").strip().casefold() != "radios":
                        source_options = {
                            option: source_row.get(option, "").strip()
                            for option in ("Option a", "Option b", "Option c", "Option d", "Option e")
                            if source_row.get(option, "").strip()
                        }
                        if is_checkbox_source:
                            values = [
                                next(
                                    (
                                        option for option, label in source_options.items()
                                        if option.rsplit(" ", 1)[-1].casefold()
                                        == value.casefold()
                                        or label.casefold() == value.casefold()
                                    ),
                                    value,
                                )
                                for value in values
                            ]
                        else:
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

                    condition_operator = operator
                    if is_checkbox_source:
                        condition_operator = {
                            "=": "contains",
                            "<>": "notcontains",
                        }.get(operator, operator)
                    element["visibleIf"] = " or ".join(
                        f"{{{question}}} {condition_operator} '{value}'"
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
                    element["allowClear"] = False
                    if trigger_match and operator == "=":
                        reset_operator = (
                            "notcontains" if is_checkbox_source else "<>"
                        )
                        element["resetValueIf"] = " and ".join(
                            f"{{{question}}} {reset_operator} '{value}'"
                            for value in values
                        )

            elements.append(element)

        return elements

    survey = {
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
    if form_version:
        survey["formVersion"] = form_version
    return survey


def main():
    project_dir = Path(__file__).resolve().parent
    yaml_path = project_dir / "form-content.yaml"
    output_path = project_dir / "translated-survey.json"

    form_version, schema = read_schema_yaml(yaml_path)
    translated_survey = schema_to_survey(schema, form_version=form_version)

    empty_pages = [page["name"] for page in translated_survey["pages"] if not page["elements"]]
    if empty_pages:
        raise ValueError(f"No elements generated for: {', '.join(empty_pages)}")

    with output_path.open("w", encoding="utf-8") as output_file:
        json.dump(translated_survey, output_file, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    raise SystemExit(main())