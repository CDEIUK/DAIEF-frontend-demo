import csv
from pathlib import Path
import json
import posixpath
import re
import zipfile
from xml.etree import ElementTree as ET


XLSX_NAMESPACES = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "relationships": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "package": "http://schemas.openxmlformats.org/package/2006/relationships",
}
OPTION_COLUMNS = (
    "Option a",
    "Option b",
    "Option c",
    "Option d",
    "Option e",
    "Option f",
)


def read_schema_csv(csv_path):
    """Read the schema CSV and its form version."""
    with open(csv_path, encoding="utf-8-sig", newline="") as schema_file:
        csv_reader = csv.reader(schema_file)
        first_row = next(csv_reader, [])
        required_headers = {"Section", "Reference", "Field text", "Component type"}
        has_header_first = required_headers.issubset(first_row)
        if has_header_first:
            form_version = None
            schema_reader = csv.DictReader(schema_file, fieldnames=first_row)
        else:
            form_version = (first_row[0].strip() if first_row else None) or None
            schema_reader = csv.DictReader(schema_file)

        schema = [
            {
                header: clean_schema_value(value or "")
                for header, value in row.items()
                if header
            }
            for row in schema_reader
        ]
    return form_version, schema


def options_for_row(row):
    """Return choice values and labels from either supported schema format."""
    option_labels = [
        (option, row.get(option, "").strip())
        for option in OPTION_COLUMNS
        if row.get(option, "").strip()
    ]
    if option_labels:
        if row.get("Reference", "").strip().casefold() == "filter":
            return [(label, label) for _, label in option_labels]
        return option_labels

    labels = []
    for line in row.get("Options", "").splitlines():
        labels.extend(
            label.strip()
            for label in line.split(";")
            if label.strip()
        )
    if row.get("Reference", "").strip().casefold() == "filter":
        return [(label, label) for label in labels]
    return [
        (f"Option {chr(ord('a') + index)}", label)
        for index, label in enumerate(labels)
    ]


def filter_context_for_label(label):
    """Identify a FILTER option's context from its display label."""
    normalized_label = label.casefold()
    if "personal data" in normalized_label:
        return "personal"
    if "collection" in normalized_label and "data" in normalized_label:
        return "data"
    if "algorithmic" in normalized_label or "ai" in normalized_label:
        return "ai"
    if "public" in normalized_label:
        return "public"
    if "decision" in normalized_label:
        return "decision"
    if "safety-critical" in normalized_label:
        return "critical"
    return None


def condition_for_row(condition, row, page_rows, rows):
    """Translate a schema condition into SurveyJS visibility and reset expressions."""
    condition = condition.strip()
    if not condition or condition.casefold() == "none":
        return None

    condition_parts = [
        part.strip()
        for part in re.split(r"\s+OR\s+", condition, flags=re.IGNORECASE)
    ]
    match = re.fullmatch(r"(.+?)(<>|=|-)(.+)", condition_parts[0])
    if not match:
        return None

    question, operator, first_value = (part.strip() for part in match.groups())
    operator = "=" if operator == "-" else operator
    values = [first_value, *(part for part in condition_parts[1:] if part)]

    source_row = next(
        (
            candidate for candidate in page_rows
            if candidate["Reference"].strip() == question
        ),
        None,
    )
    if source_row is None:
        current_index = next(
            (index for index, candidate in enumerate(rows) if candidate is row),
            len(rows),
        )
        source_row = next(
            (
                candidate for candidate in reversed(rows[:current_index])
                if candidate["Reference"].strip() == question
            ),
            None,
        )
    if source_row is None and question.isdigit():
        source_row = next(
            (
                candidate for candidate in page_rows
                if candidate.get("Component type", "").strip().casefold() == "radios"
                and re.match(rf"^{re.escape(question)}[a-z]*$", candidate["Reference"].strip())
            ),
            None,
        )

    question_name = question
    is_checkbox_source = False
    if source_row is not None:
        question_name = source_row["Reference"].strip()
        source_component = source_row.get("Component type", "").strip().casefold()
        is_checkbox_source = source_component == "multiselect"

        if source_component != "radios":
            source_options = dict(options_for_row(source_row))
            values = [
                next(
                    (
                        option for option, label in source_options.items()
                        if (
                            is_checkbox_source
                            and option.rsplit(" ", 1)[-1].casefold() == value.casefold()
                        )
                        or label.casefold() == value.casefold()
                        or (
                            question_name.casefold() == "filter"
                            and filter_context_for_label(label) == value.casefold()
                        )
                    ),
                    value,
                )
                for value in values
            ]

    condition_operator = operator
    reset_operator = "<>"
    if is_checkbox_source:
        condition_operator = {
            "=": "contains",
            "<>": "notcontains",
        }.get(operator, operator)
        reset_operator = "notcontains"

    visible_if = " or ".join(
        f"{{{question_name}}} {condition_operator} '{value}'"
        for value in values
    )
    reset_if = None
    if operator == "=":
        reset_if = " and ".join(
            f"{{{question_name}}} {reset_operator} '{value}'"
            for value in values
        )

    return {"visibleIf": visible_if, "resetValueIf": reset_if}


section_descriptions = {
    "Project Detail": "Provide the key information about your project and change the questions you see using filters.",
    "Discovery": "Discovery is the project research and scoping phase. You are understanding the problem that needs to be solved and the opportunities for addressing them using data and AI. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">discovery phase</a> in a new tab.<br><br>",    
    "Alpha": "Alpha is the initial solution development phase. You are building prototypes to test your ideas and assumptions, and to gather feedback from users. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">alpha phase</a> in a new tab.<br><br>",
    "Beta": "Beta is the phase where you are building the solution that best solves your problem. You are refining your solution based on user feedback and preparing for launch. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-beta-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">beta phase</a> in a new tab.<br><br>",
    "Live": "Live is the phase where your solution is available to users. You are monitoring performance and gathering feedback to inform future improvements. Learn more about the <a href=\"https://www.gov.uk/service-manual/agile-delivery/how-the-live-phase-works\" target=\"_blank\" rel=\"noopener noreferrer\">live phase</a> in a new tab.<br><br>",
}


def read_schema_xlsx(xlsx_path):
    """Read the schema-input worksheet and its optional form version."""
    with zipfile.ZipFile(xlsx_path) as workbook:
        workbook_xml = ET.fromstring(workbook.read("xl/workbook.xml"))
        workbook_relationships = ET.fromstring(
            workbook.read("xl/_rels/workbook.xml.rels")
        )
        relationship_targets = {
            relationship.attrib["Id"]: relationship.attrib["Target"]
            for relationship in workbook_relationships.findall(
                "package:Relationship", XLSX_NAMESPACES
            )
        }

        schema_sheet = next(
            (
                sheet
                for sheet in workbook_xml.findall(
                    "main:sheets/main:sheet", XLSX_NAMESPACES
                )
                if sheet.attrib["name"] == "schema-input"
            ),
            None,
        )
        if schema_sheet is None:
            raise ValueError("Workbook does not contain a 'schema-input' sheet")

        sheet_target = relationship_targets[
            schema_sheet.attrib[
                f"{{{XLSX_NAMESPACES['relationships']}}}id"
            ]
        ]
        sheet_path = posixpath.normpath(posixpath.join("xl", sheet_target))
        worksheet_xml = ET.fromstring(workbook.read(sheet_path))

        shared_strings = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            strings_xml = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
            shared_strings = [
                "".join(
                    text.text or ""
                    for text in item.findall(".//main:t", XLSX_NAMESPACES)
                )
                for item in strings_xml.findall("main:si", XLSX_NAMESPACES)
            ]

        def cell_value(cell):
            cell_type = cell.attrib.get("t")
            if cell_type == "inlineStr":
                value = "".join(
                    text.text or ""
                    for text in cell.findall(".//main:t", XLSX_NAMESPACES)
                )
            else:
                value_node = cell.find("main:v", XLSX_NAMESPACES)
                value = value_node.text if value_node is not None else ""
                if cell_type == "s" and value:
                    value = shared_strings[int(value)]
            return clean_schema_value(value)

        rows_by_number = {
            int(row.attrib["r"]): row
            for row in worksheet_xml.findall(
                "main:sheetData/main:row", XLSX_NAMESPACES
            )
        }

        first_row = rows_by_number.get(1)
        form_version = ""
        if first_row is not None:
            form_version = next(
                (
                    cell_value(cell).strip()
                    for cell in first_row.findall("main:c", XLSX_NAMESPACES)
                    if cell.attrib["r"] == "A1"
                ),
                "",
            )

        header_row_number = None
        headers_by_column = {}
        for row_number, row in sorted(rows_by_number.items()):
            row_values = {
                re.match(r"[A-Z]+", cell.attrib["r"]).group(): cell_value(cell)
                for cell in row.findall("main:c", XLSX_NAMESPACES)
            }
            if {"Section", "Reference", "Field text", "Component type"}.issubset(
                row_values.values()
            ):
                header_row_number = row_number
                headers_by_column = {
                    column: value
                    for column, value in row_values.items()
                    if value
                }
                break

        if header_row_number is None:
            raise ValueError(
                "Could not find schema headers on the 'schema-input' sheet"
            )

        schema = []
        for row_number, row in sorted(rows_by_number.items()):
            if row_number <= header_row_number:
                continue
            row_values = {
                re.match(r"[A-Z]+", cell.attrib["r"]).group(): cell_value(cell)
                for cell in row.findall("main:c", XLSX_NAMESPACES)
            }
            if any(row_values.values()):
                schema.append(
                    {
                        header: row_values.get(column, "")
                        for column, header in headers_by_column.items()
                    }
                )

    return form_version or None, schema


def clean_schema_value(value):
    if not value:
        return ""
    value = value.strip()
    if value == "0":
        return ""
    return (
        value.replace("�s", "'s")
        .replace("�re", "'re")
        .replace("�ve", "'ve")
        .replace("�d", "'d")
        .replace("�ll", "'ll")
        .replace("�", "")
        .replace("Õ", "'")
        .replace("Ê", "")
    )


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


def csv_to_survey(
    rows,
    pages=None,
    page_name="page1",
    page_title="Discovery",
    page_description="Phase 1 of your project.",
    section_descriptions=section_descriptions,
    form_version=None,
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
        document_or_action_groups = set()
        full_width_root_groups = set()

        for row in page_rows:
            reference = row["Reference"].strip()
            field_text = row["Field text"].strip()
            link_text = (
                row.get("Field text link")
                or row.get("Field text hyperlinks")
                or ""
            ).strip()
            field_text = add_field_text_hyperlinks(field_text, link_text)
            field_text = re.sub(r"(?m)^[ \t]*(?=[•*-]\s)", "  ", field_text)    
            component_type = row["Component type"].strip().lower()
            trigger = row["Trigger"].strip()
            if trigger.lower() == "none":
                trigger = ""

            if not reference or not field_text:
                continue

            group_match = re.match(r"\d+", reference)
            field_group = group_match.group() if group_match else None
            is_root = row.get("Root", "").strip().casefold() == "y"
            is_document_or_action = field_group is not None and (
                "T" in reference
                or reference.endswith("S")
                or component_type in {"document", "action", "text", "suggestion"}
            )
            survey_type = {
                "radios": "radiogroup",
                "action": "expression",
                "suggestion": "expression",
                "info": "expression",
                "context": "expression",
                "document": "comment",
                "text": "comment",
                "short text": "text",
                "multiselect": "checkbox",
            }.get(component_type, component_type)
            is_project_detail = (
                row.get("Section", "").strip().casefold() == "project detail"
            )
            line_break_needed = (
                is_project_detail
                or is_root
                or reference.isdigit()
                or survey_type == "comment"
                or component_type in {"context", "info"}
                or field_group in full_width_root_groups
            )
            if is_document_or_action and field_group not in document_or_action_groups:
                line_break_needed = True
                document_or_action_groups.add(field_group)

            element = {
                "type": survey_type,
                "name": reference,
                "startWithNewLine": line_break_needed,
            }
            if is_root:
                element["isRoot"] = True
            if is_root or re.fullmatch(r"\d+", reference):
                question_set_header = row.get("Question set header", "").strip()
                if question_set_header and question_set_header != "0":
                    element["questionSetHeader"] = question_set_header
            if component_type in {"context", "info"}:
                element["isContext"] = True

            if is_root or re.fullmatch(r"\d+", reference):
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

            element["title"] = field_text

            hint_text = row.get("Hint text", "").strip()
            if hint_text and hint_text != "0":
                element["description"] = hint_text

            context_condition = condition_for_row(
                row.get("Context filter", ""), row, page_rows, rows
            )
            trigger_condition = condition_for_row(trigger, row, page_rows, rows)
            conditions = [
                condition["visibleIf"]
                for condition in (context_condition, trigger_condition)
                if condition is not None
            ]
            if conditions:
                element["visibleIf"] = " and ".join(
                    f"({condition})" for condition in conditions
                )

            if element["type"] in ("radiogroup", "checkbox"):
                option_labels = options_for_row(row)
                if element["type"] == "checkbox":
                    element["choices"] = [
                        {"value": option, "text": label}
                        for option, label in option_labels
                    ]
                else:
                    has_other_choice = any(
                        label.casefold() == "other"
                        for _, label in option_labels
                    )
                    element["choices"] = [
                        label for _, label in option_labels
                        if label.casefold() != "other"
                    ]
                    element["allowClear"] = False
                    if has_other_choice:
                        element["showOtherItem"] = True
                    reset_conditions = [
                        condition["resetValueIf"]
                        for condition in (context_condition, trigger_condition)
                        if condition is not None and condition["resetValueIf"]
                    ]
                    if reset_conditions:
                        element["resetValueIf"] = " or ".join(
                            f"({condition})" for condition in reset_conditions
                        )

            elements.append(element)
            if is_root and component_type in {"context", "info"}:
                full_width_root_groups.add(field_group)

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
    csv_path = project_dir / "schema-input.csv"
    output_path = project_dir / "translated-survey.json"

    form_version, schema = read_schema_csv(csv_path)
    translated_survey = csv_to_survey(schema, form_version=form_version)

    empty_pages = [page["name"] for page in translated_survey["pages"] if not page["elements"]]
    if empty_pages:
        raise ValueError(f"No elements generated for: {', '.join(empty_pages)}")

    with output_path.open("w", encoding="utf-8") as output_file:
        json.dump(translated_survey, output_file, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()