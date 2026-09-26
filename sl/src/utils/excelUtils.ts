import * as XLSX from 'xlsx';
import { QuizQuestion, MCQAssessment, StudentQuizResult } from '../types';

// 1. Download official MCQ Excel Template
export function downloadExcelTemplate() {
  const templateData = [
    {
      'Question Text': 'What is the capital of India?',
      'Question Image URL': 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=500',
      'Option A': 'Mumbai',
      'Option A Image URL': '',
      'Option B': 'New Delhi',
      'Option B Image URL': '',
      'Option C': 'Kolkata',
      'Option C Image URL': '',
      'Option D': 'Chennai',
      'Option D Image URL': '',
      'Correct Option (A/B/C/D)': 'B',
      'Points': 10,
      'Time (Seconds)': 30
    },
    {
      'Question Text': 'Which element has the chemical symbol "Au"?',
      'Question Image URL': '',
      'Option A': 'Silver',
      'Option A Image URL': '',
      'Option B': 'Copper',
      'Option B Image URL': '',
      'Option C': 'Gold',
      'Option C Image URL': '',
      'Option D': 'Platinum',
      'Option D Image URL': '',
      'Correct Option (A/B/C/D)': 'C',
      'Points': 5,
      'Time (Seconds)': 20
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MCQ_Template');
  XLSX.writeFile(wb, 'smart_learn_mcq_template.xlsx');
}

export const downloadMCQTemplate = downloadExcelTemplate;

// 2. Export an existing MCQ assessment to Excel
export function exportMCQToExcel(mcq: MCQAssessment) {
  const data = mcq.questions.map((q, idx) => ({
    'Sl No': idx + 1,
    'Question Text': q.questionText,
    'Question Image': q.questionImage || '',
    'Option A': q.options[0]?.text || '',
    'Option B': q.options[1]?.text || '',
    'Option C': q.options[2]?.text || '',
    'Option D': q.options[3]?.text || '',
    'Correct Answer': q.correctOptionId,
    'Points': q.points,
    'Time (Seconds)': q.timeSeconds
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MCQ_Questions');
  const sanitizedTitle = mcq.title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
  XLSX.writeFile(wb, `smart_learn_${sanitizedTitle}_questions.xlsx`);
}

// 3. Export student reports to Excel
export function exportReportsToExcel(reports: StudentQuizResult[], fileNamePrefix = 'smart_learn_reports') {
  const data = reports.map((r, idx) => ({
    'Rank': idx + 1,
    'Student Name': r.studentName,
    'School Name': r.schoolName,
    'Email Address': r.studentEmail,
    'Assessment Title': r.assessmentTitle,
    'Live PIN': r.pin,
    'Score Earned': r.score,
    'Total Possible Score': r.totalScore,
    'Percentage (%)': r.totalScore > 0 ? Math.round((r.score / r.totalScore) * 100) : 0,
    'Correct Answers': r.correctCount,
    'Wrong Answers': r.wrongCount,
    'Missed/Unanswered': r.missedCount,
    'Total Questions': r.totalQuestions,
    'Submission Date': new Date(r.completedAt).toLocaleString()
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student_Scores');
  XLSX.writeFile(wb, `${fileNamePrefix}_${Date.now()}.xlsx`);
}

// 4. Export single student report or multiple to CSV
export function exportToCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      headers.map(header => {
        let cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
        cell = cell.replace(/"/g, '""');
        if (cell.search(/("|,|\n)/g) >= 0) {
          cell = `"${cell}"`;
        }
        return cell;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 5. Parse and auto-validate uploaded Excel file into QuizQuestions
export interface ParseExcelResult {
  valid: boolean;
  errors: string[];
  questions: QuizQuestion[];
}

export async function parseExcelQuestions(file: File): Promise<ParseExcelResult> {
  const errors: string[] = [];
  const questions: QuizQuestion[] = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      return { valid: false, errors: ['The uploaded workbook contains no worksheets.'], questions: [] };
    }

    const ws = wb.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<any>(ws);

    if (!rawRows || rawRows.length === 0) {
      return { valid: false, errors: ['The Excel sheet is empty. Please enter questions.'], questions: [] };
    }

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // considering 1-based header row

      const questionText = row['Question Text'] || row['Question'] || row['question'] || '';
      const optA = row['Option A'] || row['A'] || row['option_a'] || '';
      const optB = row['Option B'] || row['B'] || row['option_b'] || '';
      const optC = row['Option C'] || row['C'] || row['option_c'] || '';
      const optD = row['Option D'] || row['D'] || row['option_d'] || '';
      let correctRaw = row['Correct Option (A/B/C/D)'] || row['Correct'] || row['Answer'] || row['correct'] || '';

      const optAImg = row['Option A Image URL'] || '';
      const optBImg = row['Option B Image URL'] || '';
      const optCImg = row['Option C Image URL'] || '';
      const optDImg = row['Option D Image URL'] || '';
      const qImg = row['Question Image URL'] || row['Image'] || '';
      const points = Number(row['Points'] || row['points'] || 5);
      const timeSeconds = Number(row['Time (Seconds)'] || row['Time'] || 30);

      if (!questionText.toString().trim()) {
        errors.push(`Row ${rowNum}: Question text is missing.`);
        return;
      }
      if (!optA.toString().trim() || !optB.toString().trim() || !optC.toString().trim() || !optD.toString().trim()) {
        errors.push(`Row ${rowNum}: All 4 options (A, B, C, D) are required.`);
        return;
      }

      const cleanCorrect = correctRaw.toString().trim().toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(cleanCorrect)) {
        errors.push(`Row ${rowNum}: Correct Option must be one of 'A', 'B', 'C', or 'D' (Found: "${correctRaw}").`);
        return;
      }

      questions.push({
        id: 'q_ex_' + Date.now() + '_' + index,
        questionText: questionText.toString().trim(),
        questionImage: qImg.toString().trim() || undefined,
        options: [
          { id: 'A', text: optA.toString().trim(), image: optAImg.toString().trim() || undefined },
          { id: 'B', text: optB.toString().trim(), image: optBImg.toString().trim() || undefined },
          { id: 'C', text: optC.toString().trim(), image: optCImg.toString().trim() || undefined },
          { id: 'D', text: optD.toString().trim(), image: optDImg.toString().trim() || undefined }
        ],
        correctOptionId: cleanCorrect as 'A' | 'B' | 'C' | 'D',
        points: isNaN(points) || points <= 0 ? 5 : points,
        timeSeconds: isNaN(timeSeconds) || timeSeconds <= 0 ? 30 : timeSeconds
      });
    });

    return {
      valid: errors.length === 0,
      errors,
      questions
    };
  } catch (err: any) {
    return {
      valid: false,
      errors: [err.message || 'Failed to parse Excel file. Ensure valid .xlsx/.xls format.'],
      questions: []
    };
  }
}

export const parseMCQExcel = async (file: File) => {
  const res = await parseExcelQuestions(file);
  return {
    isValid: res.valid,
    errors: res.errors,
    questions: res.questions
  };
};
