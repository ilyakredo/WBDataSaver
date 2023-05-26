import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import download from "download";
import fs from "fs";
import os from "os";
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as fsExtra from "fs-extra";

const firebaseConfig = {
  apiKey: "AIzaSyDbAmfv71BQBKBQCwbxdNpxl-IGPT4vGjg",
  authDomain: "wbdatarepo.firebaseapp.com",
  projectId: "wbdatarepo",
  storageBucket: "wbdatarepo.appspot.com",
  messagingSenderId: "508655951672",
  appId: "1:508655951672:web:e109e0f0c205a645536bcd",
  measurementId: "G-E2H5TXN0YN",
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

const app = express();
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(express.json({ limit: "50mb" }));
const PORT = process.env.PORT || 4300;

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.sendFile("/index.html");
});

app.post("/load_file", upload.single("excelFile"), async (req, res) => {
  deleteFiles();
  const imageUrls = [];
  const itemsIds = [];
  const uploadedFile = req.file;
  if (!uploadedFile) {
    return res.status(400).send("No file uploaded");
  }
  const workbook = XLSX.readFile(uploadedFile.path);
  const sheetName = workbook.SheetNames[0];
  const workSheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(workSheet);
  jsonData.forEach((dataItem) => {
    imageUrls.push(dataItem["Медиафайлы"].split(";"));
    itemsIds.push(dataItem["Артикул продавца"]);
  });
  const fbUrlsArr = await imageProcess(imageUrls, itemsIds);
  for (let ind = 0; ind < jsonData.length; ind++) {
    jsonData[ind]["Медиафайлы"] = fbUrlsArr[ind];
  }
  res.send(JSON.stringify(jsonData));
});

app.post("/download_results", (req, res) => {
  let resultData = req.body;
  resultData.forEach((elem) => {
    elem["Медиафайлы"] = elem["Медиафайлы"].toString().replaceAll(",", ";");
  });
  const workSheet = XLSX.utils.json_to_sheet(resultData);
  const workBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workBook, workSheet, "Sheet1");
  const excelBuffer = XLSX.write(workBook, {
    bookType: "xlsx",
    type: "buffer",
  });
  const date = new Date();
  let fileName = `storageData-${date.toLocaleString().slice(0, -3)}`;
  fileName = fileName.replace(", ", " ").replaceAll(":", "-");
  // Поиск папки dowloads в windows
  const homeDir = os.homedir();
  const downloadDir = `${homeDir}/Downloads`;
  fs.writeFileSync(`${downloadDir}/${fileName}.xlsx`, excelBuffer);
  // Чистка папки uploads
  fsExtra.emptyDirSync("uploads");
  ///
  res.send(JSON.stringify({ message: "ФАЙЛ УСПЕШНО СОХРАНЁН В ЗАГРУЗКИ" }));
});

app.listen(PORT, () => {
  console.log("Server started on port: 4300 ...");
});

const imageProcess = async (imgArr, idArr) => {
  let itemsQtt = Number(imgArr.length);
  const resultUrlArr = [];
  for (let ind = 0; ind < imgArr.length; ind++) {
    console.log(`Items left - ${itemsQtt--}`);
    if (imgArr[ind]) {
      let fileName = idArr[ind];
      if (imgArr[ind].length > 1) {
        const fbUrlArr = [];
        let count = 0;
        for (let imageUrl of imgArr[ind]) {
          if (count > 0) {
            fileName = `${idArr[ind]}-${count}`;
          }
          fs.writeFileSync(
            `public/tmp-img/${fileName}.jpg`,
            await download(imageUrl)
          );
          count++;
          const fbFileUrl = await uploadFirebase(fileName);
          if (fbFileUrl) {
            fbUrlArr.push(fbFileUrl);
          } else {
            fbUrlArr.push("");
          }
        }
        resultUrlArr.push(fbUrlArr);
      } else {
        fs.writeFileSync(
          `public/tmp-img/${fileName}.jpg`,
          await download(imgArr[ind][0])
        );
        const fbFileUrl = await uploadFirebase(fileName);
        if (fbFileUrl) {
          resultUrlArr.push([fbFileUrl]);
        } else {
          resultUrlArr.push([]);
        }
      }
    } else {
      resultUrlArr.push([]);
    }
    console.log("-------------------------");
  }
  return resultUrlArr;
};

const uploadFirebase = async (fileName) => {
  const imageRef = ref(storage, `${fileName}.jpg`);
  const uploadFile = fs.readFileSync(`public/tmp-img/${fileName}.jpg`);
  await uploadBytes(imageRef, uploadFile).then((snapshot) => {
    console.log(`File ${fileName}.jpg uploaded successfully!`);
  });
  const firebaseFileRef = await getDownloadURL(imageRef);
  console.log(`File URL: ${firebaseFileRef}`);
  return firebaseFileRef;
};

function deleteFiles() {
  try {
    // Удаление изображений
    fsExtra.emptyDirSync("public/tmp-img");
  } catch (e) {
    console.log(err);
  }
}

// const handleData = (data) => {
//   const finalDataArr = [];

//   data.forEach((elem) => {
//     const dataObj = {};
//     let count = 1;
//     for (let key in elem) {
//       dataObj[count] = elem[key];
//       count++;
//     }
//     finalDataArr.push(dataObj);
//   });
//   return finalDataArr;
// };
