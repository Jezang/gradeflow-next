import type {scoreExportTable} from './score-export';

export async function scoreExportXlsx(table: ReturnType<typeof scoreExportTable>) {
  const {default: ExcelJS} = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Scores');
  worksheet.addRows(table);
  worksheet.columns.forEach(column => {column.width = 22});
  worksheet.getRow(5).font = {bold: true};
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}
