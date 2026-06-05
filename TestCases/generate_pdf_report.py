import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def create_pdf_report(results, output_filename="test_report.pdf"):
    """
    Generate a PDF report from a list of test results.
    `results` should be a list of dictionaries:
    [{'name': 'test_name', 'status': 'passed|failed|skipped', 'duration': 1.2, 'error': 'error msg'}]
    """
    doc = SimpleDocTemplate(output_filename, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()

    # Title
    title_style = styles['Heading1']
    title_style.alignment = 1 # Center
    elements.append(Paragraph("Medical Camp - Automated Test Execution Report", title_style))
    elements.append(Spacer(1, 12))

    # Summary
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r['status'] == 'passed')
    failed_tests = sum(1 for r in results if r['status'] == 'failed')
    skipped_tests = sum(1 for r in results if r['status'] == 'skipped')
    
    summary_text = (
        f"<b>Execution Date:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}<br/>"
        f"<b>Total Tests:</b> {total_tests}<br/>"
        f"<b>Passed:</b> {passed_tests} <font color='green'>&#10004;</font><br/>"
        f"<b>Failed:</b> {failed_tests} <font color='red'>&#10008;</font><br/>"
        f"<b>Skipped:</b> {skipped_tests}"
    )
    elements.append(Paragraph(summary_text, styles['Normal']))
    elements.append(Spacer(1, 20))

    # Details Table
    data = [['Test Case Name', 'Duration (s)', 'Status', 'Error / Notes']]
    
    # Custom styles for table cells
    error_style = ParagraphStyle('ErrorStyle', parent=styles['Normal'], fontSize=8, textColor=colors.red)
    normal_style = ParagraphStyle('NormalStyle', parent=styles['Normal'], fontSize=9)
    
    for result in results:
        name = Paragraph(result['name'], normal_style)
        duration = f"{result['duration']:.2f}"
        
        # Status coloring
        status_text = result['status'].upper()
        if status_text == 'PASSED':
            status = Paragraph(f"<font color='green'><b>{status_text}</b></font>", normal_style)
        elif status_text == 'FAILED':
            status = Paragraph(f"<font color='red'><b>{status_text}</b></font>", normal_style)
        else:
            status = Paragraph(f"<font color='gray'><b>{status_text}</b></font>", normal_style)
            
        error_msg = result.get('error', '')
        error = Paragraph(error_msg[:200] + ('...' if len(error_msg) > 200 else ''), error_style)
        
        data.append([name, duration, status, error])

    # Calculate column widths
    col_widths = [220, 70, 70, 180]

    table = Table(data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.teal),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (1, 0), (2, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    
    elements.append(table)
    
    # Build PDF
    doc.build(elements)
    print(f"\\n--- PDF Report successfully generated: {output_filename} ---")

if __name__ == "__main__":
    # Test generation script directly
    dummy_data = [
        {"name": "test_auth_page_loading", "status": "passed", "duration": 1.45, "error": ""},
        {"name": "test_auth_missing_inputs", "status": "failed", "duration": 0.32, "error": "AssertionError: expected 'Authorize'"},
    ]
    create_pdf_report(dummy_data, "sample_report.pdf")
