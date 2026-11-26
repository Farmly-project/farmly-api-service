import ExcelJS from "exceljs";

export interface ExcelReportPayload {
  period: { start_date: string; end_date: string };
  summary: {
    gross_revenue: number;
    refunded_amount: number;
    net_revenue: number;
    total_orders: number;
    delivered_orders: number;
    cancelled_orders: number;
    active_subscriptions: number;
    total_imported_qty: number;
    total_disposed_qty: number;
    overall_disposal_rate: number;
  };
  revenueByDay: Array<{
    date: string;
    delivered_orders_count: number;
    retail_revenue: number;
    subscription_revenue: number;
    refunded_amount: number;
    net_revenue: number;
  }>;
  disposalReport: Array<{
    batch_code: string;
    product_name: string;
    unit: string;
    harvest_date: string | null;
    exp_date: string | null;
    initial_quantity: number;
    current_quantity: number;
    disposed_quantity: number;
    disposal_rate: number;
    status: string;
  }>;
  topProducts: Array<{
    product_id: number;
    product_name: string;
    total_quantity_sold: number;
    total_revenue: number;
  }>;
}

const styleHeaderRow = (row: ExcelJS.Row) => {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2E7D32" }, // Xanh lá thương hiệu Farmly
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
  row.height = 26;
};

export const buildFarmlyExcelReportBuffer = async (
  payload: ExcelReportPayload,
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Farmly Organic System";
  workbook.created = new Date();

  // ============================================================================
  // SHEET 1: TỔNG QUAN KINH DOANH & TOP SẢN PHẨM
  // ============================================================================
  const summarySheet = workbook.addWorksheet("Tong_Quan");
  summarySheet.columns = [
    { width: 38 },
    { width: 25 },
    { width: 22 },
    { width: 25 },
  ];

  summarySheet.mergeCells("A1:D1");
  const titleCell = summarySheet.getCell("A1");
  titleCell.value = `BÁO CÁO THỐNG KÊ HOẠT ĐỘNG NÔNG TRẠI FARMLY (${payload.period.start_date} → ${payload.period.end_date})`;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF1B5E20" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  summarySheet.getRow(1).height = 30;

  summarySheet.addRow([]);
  const kpiHeader = summarySheet.addRow([
    "Chỉ số tổng quan",
    "Giá trị",
    "Đơn vị",
    "Ghi chú",
  ]);
  styleHeaderRow(kpiHeader);

  const kpiRows = [
    [
      "Doanh thu gộp (Đơn đã giao + Gói định kỳ)",
      payload.summary.gross_revenue,
      "VNĐ",
      "Trước hoàn tiền",
    ],
    [
      "Tổng tiền đã hoàn trả khiếu nại",
      payload.summary.refunded_amount,
      "VNĐ",
      "Theo UC03",
    ],
    [
      "Doanh thu thuần thực tế (Net Revenue)",
      payload.summary.net_revenue,
      "VNĐ",
      "Doanh thu gộp - Hoàn tiền",
    ],
    [
      "Tổng số đơn hàng phát sinh",
      payload.summary.total_orders,
      "Đơn",
      "Tất cả trạng thái",
    ],
    [
      "Số đơn đã giao thành công (Delivered)",
      payload.summary.delivered_orders,
      "Đơn",
      "",
    ],
    ["Số đơn đã hủy (Cancelled)", payload.summary.cancelled_orders, "Đơn", ""],
    [
      "Số gói định kỳ đang hoạt động",
      payload.summary.active_subscriptions,
      "Gói",
      "",
    ],
    [
      "Tổng sản lượng thu hoạch nhập kho",
      payload.summary.total_imported_qty,
      "Đơn vị",
      "",
    ],
    [
      "Tổng sản lượng xuất hủy / hao hụt",
      payload.summary.total_disposed_qty,
      "Đơn vị",
      "Theo UC05",
    ],
    [
      "Tỷ lệ hao hụt trung bình toàn trại",
      payload.summary.overall_disposal_rate,
      "%",
      "Xuất hủy / Nhập kho",
    ],
  ];

  kpiRows.forEach((r) => {
    const row = summarySheet.addRow(r);
    if (r[2] === "VNĐ") {
      row.getCell(2).numFmt = "#,##0";
    }
  });

  summarySheet.addRow([]);
  const topHeader = summarySheet.addRow([
    "Top Sản phẩm bán chạy",
    "Mã SP",
    "Sản lượng đã giao",
    "Doanh thu mang lại (VNĐ)",
  ]);
  styleHeaderRow(topHeader);

  payload.topProducts.forEach((p) => {
    const row = summarySheet.addRow([
      p.product_name,
      p.product_id,
      p.total_quantity_sold,
      p.total_revenue,
    ]);
    row.getCell(4).numFmt = "#,##0";
  });

  // ============================================================================
  // SHEET 2: DOANH THU THỰC TẾ THEO NGÀY
  // ============================================================================
  const revSheet = workbook.addWorksheet("Doanh_Thu_Theo_Ngay");
  revSheet.columns = [
    { header: "Ngày", key: "date", width: 16 },
    { header: "Số đơn đã giao", key: "delivered_orders_count", width: 18 },
    { header: "Doanh thu đơn lẻ (VNĐ)", key: "retail_revenue", width: 24 },
    {
      header: "Doanh thu gói định kỳ (VNĐ)",
      key: "subscription_revenue",
      width: 26,
    },
    { header: "Hoàn tiền khiếu nại (VNĐ)", key: "refunded_amount", width: 24 },
    { header: "Doanh thu thuần (VNĐ)", key: "net_revenue", width: 24 },
  ];
  styleHeaderRow(revSheet.getRow(1));

  payload.revenueByDay.forEach((item) => {
    const row = revSheet.addRow(item);
    [
      "retail_revenue",
      "subscription_revenue",
      "refunded_amount",
      "net_revenue",
    ].forEach((col) => {
      row.getCell(col).numFmt = "#,##0";
    });
  });

  // ============================================================================
  // SHEET 3: BÁO CÁO XUẤT HỦY & HAO HỤT THEO LÔ
  // ============================================================================
  const dispSheet = workbook.addWorksheet("Bao_Cao_Hao_Hut_Lo");
  dispSheet.columns = [
    { header: "Mã lô (Batch Code)", key: "batch_code", width: 24 },
    { header: "Tên nông sản", key: "product_name", width: 28 },
    { header: "ĐVT", key: "unit", width: 10 },
    { header: "Ngày thu hoạch", key: "harvest_date", width: 16 },
    { header: "Hạn sử dụng", key: "exp_date", width: 16 },
    { header: "SL nhập kho", key: "initial_quantity", width: 15 },
    { header: "SL tồn hiện tại", key: "current_quantity", width: 16 },
    { header: "SL xuất hủy", key: "disposed_quantity", width: 15 },
    { header: "Tỷ lệ hao hụt (%)", key: "disposal_rate", width: 18 },
    { header: "Trạng thái lô", key: "status", width: 16 },
  ];
  styleHeaderRow(dispSheet.getRow(1));

  payload.disposalReport.forEach((b) => {
    const row = dispSheet.addRow(b);
    row.getCell("disposal_rate").numFmt = "0.00";
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
};
