const XLXS = require("xlsx");
const fs = require("fs");

const MAPPING_FOLDER = "mapping";

const ODD_WORKSHEETS = [
  {
    name: "ACDC_Converter",
    inverse: "A1:B4",
    range: 4,
    header: ["key", "value"],
  },
  {
    name: "Charge_Controller",
    inverse: "A1:B2",
    range: 2,
    header: ["key", "value"],
  },
];

const trimArrayOfObjects = (data) => {
  return data?.map((d) => {
    return Object.keys(d).reduce((acc, key) => {
      acc[key.trim()] = d[key];
      return acc;
    }, {});
  });
};

const sanitizeData = (data) => {
  if (data?.length) {
    return trimArrayOfObjects(data);
  }
  if (data?.columnData) {
    const columnData = trimArrayOfObjects(data.columnData);
    const rowData = trimArrayOfObjects(data.rowData);
    return { columnData, rowData };
  }
  return data;
};

const createMapping = (json, output) => {
  if (!Object.keys(json).length) return;
  const filePath = `${MAPPING_FOLDER}/${output}.json`;
  json = JSON.stringify(json, null, 4);
  fs.writeFile(filePath, json, function (err) {
    if (!err) {
      console.log("Mapping Saved Successfully");
    }
  });
};

const simplifyHeader = (header) => {
  return header.replace(/[^\w\s]/g, "").replace(/\s+/g, "_");
};

const sanitizeMappingData = (data) => {
  let mappingData = {};
  if (data?.length) {
    const keys = Object.keys(data[0]);
    keys.map((key) => {
      const formattedKey = simplifyHeader(key);
      mappingData[`${formattedKey}`] = key;
    });
  }
  if (data?.columnData) {
    const columnData = data?.columnData;
    const rowData = data?.rowData;
    const columnKeys = Object.keys(columnData[0]);
    const rowKeys = Object.keys(rowData[0]);
    columnKeys.map((key) => {
      const formattedKey = simplifyHeader(key);
      mappingData[`${formattedKey}`] = key;
    });
    rowKeys.map((key) => {
      const formattedKey = simplifyHeader(key);
      mappingData[`${formattedKey}`] = key;
    });
  }
  return mappingData;
};

const fetchDataFromSheet = ({ sheet, worksheet, fileName }) => {
  const { status, options } = checkIfOddWorkSheet(sheet);
  let data = [];
  if (status) {
    const rowOptions = {
      range: options?.range,
      headers: 1,
    };
    const colOptions = {
      header: options.header,
      range: options.inverse,
    };
    let columnData = XLXS.utils
      .sheet_to_json(worksheet, colOptions)
      .reduce((accumulator, current) => {
        accumulator[current.key] = current.value;
        return accumulator;
      }, {});

    const rowData = XLXS.utils.sheet_to_json(worksheet, rowOptions);
    data = { columnData: [columnData], rowData };
  } else {
    data = XLXS.utils.sheet_to_json(worksheet);
  }
  data = sanitizeData(data);
  var json = JSON.stringify(data, null, 4);
  fs.writeFileSync(`json/${fileName}_${sheet}.json`, json);
  return data;
};

const processFile = async ({ country, year, path }) => {
  const firstPart = path.split("/")[1].split("_")[0];
  const fileName = `${country}_${year}`;
  const workbook = XLXS.readFile(path);
  const sheetNames = workbook.SheetNames;
  let finalData = sheetNames.map(async (sheet) => {
    const worksheet = workbook.Sheets[sheet];
    return fetchDataFromSheet({ sheet, worksheet, fileName });
  });
  finalData = await Promise.all(finalData);
  const finalMappingData = {};
  finalData.map((data) => {
    const mappingData = sanitizeMappingData(data);
    Object.assign(finalMappingData, mappingData);
  });
  createMapping(finalMappingData, firstPart);
  fs.unlink(path, (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log("File deleted successfully");
    }
  });
};

const checkIfOddWorkSheet = (sheet) => {
  const filtered = ODD_WORKSHEETS?.filter((d) => d.name === sheet);
  if (filtered?.length) return { status: true, options: filtered[0] };
  return { status: false };
};

module.exports = { processFile };
