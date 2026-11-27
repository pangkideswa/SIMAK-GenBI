/**
 * ==============================================================================
 * SIMAK GENBI - Google Drive Storage Web App (Sistem SIAPOS Engine)
 * ==============================================================================
 * Petunjuk Instalasi 1 Menit:
 * 1. Buka https://script.google.com/
 * 2. Buat Project Baru, beri nama "SIMAK GENBI - Drive Uploader"
 * 3. Hapus seluruh isi default, lalu salin dan tempelkan kode di bawah ini.
 * 4. Klik "Deploy" -> "New deployment" (Penyebaran Baru).
 * 5. Pilih tipe: "Web app" (Aplikasi Web).
 * 6. Set "Execute as": "Me (email Anda)".
 * 7. Set "Who has access": "Anyone" (Siapa saja, bahkan anonim).
 * 8. Klik "Deploy", beri izin otorisasi Google Drive Anda.
 * 9. Salin "Web app URL" (contoh: https://script.google.com/macros/s/AKfy.../exec).
 * 10. Tempelkan URL tersebut ke file `.env` di proyek SIMAK GENBI:
 *     VITE_GDRIVE_UPLOAD_URL="https://script.google.com/macros/s/.../exec"
 * ==============================================================================
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);

    if (data.action === "upload") {
      var folderName = data.folderName || "SIMAK GENBI - Berkas Izin & Dispensasi";
      var folders = DriveApp.getFoldersByName(folderName);
      var parentFolder;

      if (folders.hasNext()) {
        parentFolder = folders.next();
      } else {
        parentFolder = DriveApp.createFolder(folderName);
      }

      // Pisahkan ke subfolder jika data.subFolder dikirim (misal: "Dokumentasi Delegasi" / "Surat Izin & Validasi")
      var targetFolder = parentFolder;
      if (data.subFolder) {
        var subFolders = parentFolder.getFoldersByName(data.subFolder);
        if (subFolders.hasNext()) {
          targetFolder = subFolders.next();
        } else {
          targetFolder = parentFolder.createFolder(data.subFolder);
        }
      }

      // Decode Base64 data
      var decodedBytes = Utilities.base64Decode(data.base64);
      var blob = Utilities.newBlob(decodedBytes, data.mimeType || "application/octet-stream", data.fileName || "berkas_izin.pdf");

      // Simpan file ke Google Drive (subfolder atau folder utama)
      var file = targetFolder.createFile(blob);

      // Beri izin publik view agar panitia/BPH/Admin bisa langsung membuka link bukti izin
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      // Simpan metadata deskripsi file
      var desc = "Kategori: " + (data.subFolder || data.category || "izin") + "\n" +
                 "Pengunggah NPM: " + (data.uploaderNpm || "-") + "\n" +
                 "Nama: " + (data.uploaderName || "-") + "\n" +
                 "Agenda: " + (data.eventTitle || "-") + "\n" +
                 "Alasan / Catatan: " + (data.reason || "-") + "\n" +
                 "Waktu: " + new Date().toISOString();
      file.setDescription(desc);

      var fileUrl = file.getUrl();

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        fileId: file.getId(),
        fileUrl: fileUrl,
        downloadUrl: file.getDownloadUrl(),
        fileName: file.getName(),
        size: file.getSize()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Action tidak dikenali"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "SIMAK GENBI Google Drive Upload Engine",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}
