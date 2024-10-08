﻿// Copyright [2024] [Banana.ch SA - Lugano Switzerland]
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// @id = ch.banana.switzerland.import.creditsuisse
// @api = 1.0
// @pubdate = 2024-09-19
// @publisher = Banana.ch SA
// @description = Credit Suisse - Import account statement .csv (Banana+ Advanced)
// @description.en = Credit Suisse - Import account statement .csv (Banana+ Advanced)
// @description.de = Credit Suisse - Bewegungen importieren .csv (Banana+ Advanced)
// @description.fr = Credit Suisse - Importer mouvements .csv (Banana+ Advanced)
// @description.it = Credit Suisse - Importa movimenti .csv (Banana+ Advanced)
// @doctype = *
// @docproperties =
// @task = import.transactions
// @outputformat = transactions.simple
// @inputdatasource = openfiledialog
// @inputencoding = latin1
// @inputfilefilter = Text files (*.txt *.csv);;All files (*.*)
// @inputfilefilter.de = Text (*.txt *.csv);;Alle Dateien (*.*)
// @inputfilefilter.fr = Texte (*.txt *.csv);;Tous (*.*)
// @inputfilefilter.it = Testo (*.txt *.csv);;Tutti i files (*.*)
// @includejs = import.utilities.js

/**
 * Parse the data and return the data to be imported as a tab separated file.
 */
function exec(string, isTest) {

   var importUtilities = new ImportUtilities(Banana.document);

   if (isTest !== true && !importUtilities.verifyBananaAdvancedVersion())
      return "";

   //If the file contains double quotations marks, remove them
   var cleanString = string;
   if (cleanString.match(/""/)) {
      cleanString = cleanString.replace(/^"/mg, "");
      cleanString = cleanString.replace(/"$/mg, "");
      cleanString = cleanString.replace(/""/g, "\"");
   }

   let convertionParam = defineConversionParam(string);

   var transactions = Banana.Converter.csvToArray(string, convertionParam.separator, '"');
   let transactionsData = getFormattedData(transactions, convertionParam, importUtilities);

   // Format 1
   var format1 = new CSFormat1();
   if (format1.match(transactions)) {
      transactions = format1.convert(transactions);
      return Banana.Converter.arrayToTsv(transactions);
   }

   // Format 2
   var format2 = new CSFormat2();
   if (format2.match(transactions)) {
      transactions = format2.convert(transactions);
      return Banana.Converter.arrayToTsv(transactions);
   }

   // Format 3
   var format3 = new CSFormat3();
   if (format3.match(transactions)) {
      transactions = format3.convert(transactions);
      return Banana.Converter.arrayToTsv(transactions);
   }

   // Format 4
   var format4 = new CSFormat4();
   if (format4.match(transactions)) {
      transactions = format4.convert(transactions);
      return Banana.Converter.arrayToTsv(transactions);
   }

   // Format 5, this format works with the header names.
   var format5 = new CSFormat5();
   if (format5.match(transactionsData)) {
      transactions = format5.convert(transactionsData);
      return Banana.Converter.arrayToCsv(transactions);
   }

   // Format is unknow, return an error
   importUtilities.getUnknownFormatError();

   return "";
}

/**
 * CS Format 5
 *
 * Valutadatum,Text,Belastung,Gutschrift
 * 31.12.2023,"Zahlung QR-Rechnung",20.00,
 * 31.12.2023,"Zahlung erhalten",,10.00
*/
function CSFormat5() {

   /** Return true if the transactions match this format */
   this.match = function (transactionsData) {
      if (transactionsData.length === 0)
         return false;

      for (var i = 0; i < transactionsData.length; i++) {
         var transaction = transactionsData[i];
         var formatMatched = true;

         if (formatMatched && transaction["Date"] && transaction["Date"].length >= 10 &&
            transaction["Date"].match(/^\d{2}.\d{2}.\d{4}$/))
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched)
            return true;
      }

      return false;
   }

   this.convert = function (transactionsData) {
      var transactionsToImport = [];

      for (var i = 0; i < transactionsData.length; i++) {
         if (transactionsData[i]["Date"] && transactionsData[i]["Date"].length >= 10 &&
            transactionsData[i]["Date"].match(/^\d{2}.\d{2}.\d{4}$/)) {
            transactionsToImport.push(this.mapTransaction(transactionsData[i]));
         }
      }

      // Sort rows by date
      transactionsToImport = transactionsToImport.reverse();

      // Add header and return
      var header = [["Date", "DateValue", "Doc", "ExternalReference", "Description", "Income", "Expenses"]];
      return header.concat(transactionsToImport);
   }

   this.mapTransaction = function (transaction) {
      let mappedLine = [];

      mappedLine.push(Banana.Converter.toInternalDateFormat(transaction["Date"], "dd.mm.yyyy"));
      mappedLine.push(Banana.Converter.toInternalDateFormat("", "dd.mm.yyyy"));
      mappedLine.push("");
      mappedLine.push("");
      mappedLine.push(transaction["Description"]);
      mappedLine.push(Banana.Converter.toInternalNumberFormat(transaction["Income"], '.'));
      mappedLine.push(Banana.Converter.toInternalNumberFormat(transaction["Expenses"], '.'));

      return mappedLine;
   }
}

/**
 * CS format 4
 * 
 * Obstipse an 87.16.1047 43:46:35 REST
 * Sulliquam dombum
 * Seris,"Notipsusput Bonequat Nisi,WM75 3348 5865 2817 4454 7,Comna ParI, Secunum"
 * Icaph,8'024.64 CHF
 * Sulliquam
 * Buchungsdatum,Text,Belastung,Gutschrift,Valutadatum,Saldo,Valutasaldo,Buchungszeitpunkt
 * 31.12.2021,"Alegatinam Sonavit Einescenthost XXX ,78.16.3426 18:68 Noup Vivita 46 ,Fectit-Ut. 6843 17KD VOLO 2736 ",49.95,,31.12.2021,-1911.70,-1911.70,31.12.2021 04:27:56
 * 31.12.2021,"Alegatinam Sonavit Einescenthost XXX ,78.16.3426 18:12 Nost'p ME 71, Füxxx ,Fectit-Ut. 6843 17KD VOLO 2736 ",84.80,,31.12.2021,,-1911.70,31.12.2021 04:27:56
 * 31.12.2021,"Icaph imi Liongobangissimile ,boxäan piendipse Terunum",91.94,,31.12.2021,,-1911.70,01.01.2022 01:58:47
 */
function CSFormat4() {

   this.colDate = 0;
   this.colDescr = 1;
   this.colDebit = 2;
   this.colCredit = 3;
   this.colDateValuta = 4;
   this.colBalance = 5;

   this.colCount = 8;

   this.decimalSeparator = ".";


   /** Return true if the transactions match this format */
   this.match = function (transactions) {
      if (transactions.length === 0)
         return false;

      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];

         var formatMatched = false;
         if (transaction.length === (this.colCount))
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDate].match(/[0-9\.]+/g) && transaction[this.colDate].length === 10)
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDateValuta].match(/[0-9\.]+/g) && transaction[this.colDateValuta].length === 10)
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched)
            return true;
      }

      return false;
   }


   /** Convert the transaction to the format to be imported */
   this.convert = function (transactions) {
      var transactionsToImport = [];

      // Filter and map rows
      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];
         if (transaction.length < (this.colBalance + 1))
            continue;
         if (transaction[this.colDate].match(/[0-9\.]+/g) && transaction[this.colDate].length == 10 &&
            transaction[this.colDateValuta].match(/[0-9\.]+/g) && transaction[this.colDateValuta].length == 10)
            transactionsToImport.push(this.mapTransaction(transaction));
      }

      // Sort rows by date (just invert)
      transactionsToImport = transactionsToImport.reverse();

      // Add header and return
      var header = [["Date", "DateValue", "Doc", "Description", "Income", "Expenses"]];
      return header.concat(transactionsToImport);
   }


   this.mapTransaction = function (element) {
      var mappedLine = [];

      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], "dd.mm.yyyy"));
      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDateValuta], "dd.mm.yyyy"));
      mappedLine.push(""); // Doc is empty for now
      var tidyDescr = element[this.colDescr].replace(/ {2,}/g, ''); //remove white spaces
      tidyDescr = this.wrapDescr(tidyDescr); // wrap descr to bypass TipoFileImporta::IndovinaSeparatore problem
      mappedLine.push(tidyDescr);
      mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colCredit], this.decimalSeparator));
      mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colDebit], this.decimalSeparator));

      return mappedLine;
   }

   this.wrapDescr = function (descr) {
      descr = descr.replace(/"/g, '\\\"');
      return '"' + descr + '"';
   }
}

/**
 * CS Format 3
 *
 * Example creditsuisse.#20171103.csv
 * Exporté le 13.11.2017 / 17:30 CET,,,,,
 * Écritures,,,,,
 * Détails du compte,,,,,
 * Compte,"Compte courant 8'749.98 CHF ",Solde,CHF 8749.98,,,
 * IBAN,CH## #### #### #### #### #,BIC ,#########,,,
 * 100 dernières écritures,,,,
 * Date comptable,Moment de l'écriture,Texte,Débit,Crédit,Date de valeur,Solde
 * 05.01.2017,04.01.2017 19:09:38,"Ordre permanent",750.00,,05.01.2017,5346.68
 * 31.12.2016,31.12.2016 01:07:02,"Solde décompte des frais,selon avis séparé",15.00,,31.12.2016,6096.68
 * 31.12.2016,31.12.2016 01:07:02,"Solde des écritures de bouclement,selon avis séparé",,0.86,31.12.2016,
 * 23.12.2016,22.12.2016 19:52:31,"Bonification",,1500.00,23.12.2016,6110.82
 * 05.12.2016,02.12.2016 19:07:02,"Ordre permanent",750.00,,05.12.2016,4610.82
 * 28.11.2016,28.11.2016 04:16:39,"Ordre de bonific. Electronic Banking",2000.00,,28.11.2016,5360.82
 */

function CSFormat3() {

   this.colDate = 0;
   this.colDatePost = 1;
   this.colDescr = 2;
   this.colDebit = 3;
   this.colCredit = 4;
   this.colDateValuta = 5;
   this.colBalance = 6;

   this.decimalSeparator = ".";


   /** Return true if the transactions match this format */
   this.match = function (transactions) {
      if (transactions.length === 0)
         return false;

      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];

         var formatMatched = false;

         if (transaction.length === (this.colBalance + 1))
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDate].match(/[0-9\.]+/g) && transaction[this.colDate].length === 10)
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDateValuta].match(/[0-9\.]+/g) && transaction[this.colDateValuta].length === 10)
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched)
            return true;
      }

      return false;
   }


   /** Convert the transaction to the format to be imported */
   this.convert = function (transactions) {
      var transactionsToImport = [];

      // Filter and map rows
      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];
         if (transaction.length < (this.colBalance + 1))
            continue;
         if (transaction[this.colDate].match(/[0-9\.]+/g) && transaction[this.colDate].length === 10)
            transactionsToImport.push(this.mapTransaction(transaction));
      }

      // Sort rows by date (just invert)
      transactionsToImport = transactionsToImport.reverse();

      // Add header and return
      var header = [["Date", "DateValue", "Doc", "Description", "Income", "Expenses"]];
      return header.concat(transactionsToImport);
   }


   this.mapTransaction = function (element) {
      var mappedLine = [];

      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], "dd.mm.yyyy"));
      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDateValuta], "dd.mm.yyyy"));
      mappedLine.push(""); // Doc is empty for now
      var tidyDescr = element[this.colDescr].replace(/ {2,},/g, ' ,'); //remove white spaces
      tidyDescr = Banana.Converter.stringToCamelCase(tidyDescr);
      tidyDescr = this.wrapDescr(tidyDescr); // wrap descr to bypass TipoFileImporta::IndovinaSeparatore problem
      mappedLine.push(tidyDescr);
      mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colCredit], this.decimalSeparator));
      mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colDebit], this.decimalSeparator));

      return mappedLine;
   }

   this.wrapDescr = function (descr) {
      descr = descr.replace(/"/g, '\\\"');
      return '"' + descr + '"';
   }
}

/**
 * CS Format 2
 *
 * Example creditsuisse.#20160927.csv
 * Buchungsdatum,Text,Belastung,Gutschrift,Saldo
 * 27.09.2016,"Dauerauftrag                                   ,HAUS                                           ,Ihre Referenz: HAUS",400.00,,39.92
 * 30.09.2016,"Clearing-Zahlung                               ,Irene Rot                                      ,ZAHLUNG D-S SEPTEMBER 2016         ",,16000.00,
 * 30.09.2016,"Vergütungsauftr. Electronic Banking            ,LOHN SEPTEMBER2015                             ,Ihre Referenz: LOHN SEPTEMBER2015  ,17234-1023",5602.50,,
 * 30.09.2016,"Vergütungsauftr. Electronic Banking            ,RÜCKZAHLUNG AN XXX                             ,Ihre Referenz:                     ,RÜCKZAHLUNG AN XXX",3000.00,,
 */

function CSFormat2() {

   this.colDate = 0;
   this.colDescr = 1;
   this.colDebit = 2;
   this.colCredit = 3;
   this.colBalance = 4;

   this.decimalSeparator = ".";


   /** Return true if the transactions match this format */
   this.match = function (transactions) {
      if (transactions.length === 0)
         return false;

      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];

         var formatMatched = false;

         if (transaction.length === (this.colBalance + 1))
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDate].match(/[0-9\.]+/g) && transaction[this.colDate].length === 10)
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched)
            return true;
      }

      return false;
   }


   /** Convert the transaction to the format to be imported */
   this.convert = function (transactions) {
      var transactionsToImport = [];

      // Filter and map rows
      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];
         if (transaction.length < (this.colBalance + 1))
            continue;
         if (transaction[this.colDate].match(/[0-9\.]+/g) && transaction[this.colDate].length === 10)
            transactionsToImport.push(this.mapTransaction(transaction));
      }

      // Sort rows by date (just invert)
      transactionsToImport = transactionsToImport.reverse();

      // Add header and return
      var header = [["Date", "Doc", "Description", "Income", "Expenses"]];
      return header.concat(transactionsToImport);
   }


   this.mapTransaction = function (element) {
      var mappedLine = [];

      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], "dd.mm.yyyy"));
      mappedLine.push(""); // Doc is empty for now
      var tidyDescr = element[this.colDescr].replace(/ {2,},/g, ' ,'); //remove white spaces
      tidyDescr = Banana.Converter.stringToCamelCase(tidyDescr);
      tidyDescr = this.wrapDescr(tidyDescr); // wrap descr to bypass TipoFileImporta::IndovinaSeparatore problem
      mappedLine.push(tidyDescr);
      mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colCredit], this.decimalSeparator));
      mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colDebit], this.decimalSeparator));
      return mappedLine;
   }

   this.wrapDescr = function (descr) {
      descr = descr.replace(/"/g, '\\\"');
      return '"' + descr + '"';
   }
}

/**
 * CS Format 1
 *
 * Example A creditsuisse.#20111109.csv
 * Date comptable,Texte,Débit,Crédit,Date de valeur,Solde
 * 12.10.2011,"Ordre de bonific. Electronic Banking",950.00,,12.10.2011,15947.29
 * 12.10.2011,"Ordre de bonific. Electronic Banking",1600.00,,12.10.2011,
 * 12.10.2011,"Ordre de bonific. Electronic Banking",1868.87,,12.10.2011,
 * 03.10.2011,"Ordre de bonific. Electronic Banking",1764.18,,03.10.2011,20366.16
 
 * Example B creditsuisse.#20121115.csv
 * Buchungsdatum,Text,Belastung,Gutschrift,Valutadatum,Saldo
 * 12.11.2012,"Vergütungsauftr. Electronic Banking",10000.00,,12.11.2012,4965.05
 * 12.11.2012,"Vergütungsauftr. Electronic Banking",20000.00,,12.11.2012,
 * 09.11.2012,"Vergütungsauftr. Electronic Banking",,33849.60,09.11.2012,34965.05
 */

function CSFormat1() {

   this.colDate = 0;
   this.colDescr = 1;
   this.colDebit = 2;
   this.colCredit = 3;
   this.colDateValuta = 4;
   this.colBalance = 5;

   this.decimalSeparator = ".";


   /** Return true if the transactions match this format */
   this.match = function (transactions) {
      if (transactions.length === 0)
         return false;

      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];

         var formatMatched = false;
         if (transaction.length === (this.colBalance + 1))
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDate].match(/[0-9\.]+/g) && transaction[this.colDate].length === 10)
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched && transaction[this.colDateValuta].match(/[0-9\.]+/g) && transaction[this.colDateValuta].length === 10)
            formatMatched = true;
         else
            formatMatched = false;

         if (formatMatched)
            return true;
      }

      return false;
   }


   /** Convert the transaction to the format to be imported */
   this.convert = function (transactions) {
      var transactionsToImport = [];

      // Filter and map rows
      for (i = 0; i < transactions.length; i++) {
         var transaction = transactions[i];
         if (transaction.length < (this.colBalance + 1))
            continue;
         if (transaction[this.colDate].match(/[0-9\.]+/g) && transaction[this.colDate].length == 10 &&
            transaction[this.colDateValuta].match(/[0-9\.]+/g) && transaction[this.colDateValuta].length == 10)
            transactionsToImport.push(this.mapTransaction(transaction));
      }

      // Sort rows by date (just invert)
      transactionsToImport = transactionsToImport.reverse();

      // Add header and return
      var header = [["Date", "DateValue", "Doc", "Description", "Income", "Expenses"]];
      return header.concat(transactionsToImport);
   }


   this.mapTransaction = function (element) {
      var mappedLine = [];

      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDate], "dd.mm.yyyy"));
      mappedLine.push(Banana.Converter.toInternalDateFormat(element[this.colDateValuta], "dd.mm.yyyy"));
      mappedLine.push(""); // Doc is empty for now
      var tidyDescr = element[this.colDescr].replace(/ {2,}/g, ''); //remove white spaces
      tidyDescr = this.wrapDescr(tidyDescr); // wrap descr to bypass TipoFileImporta::IndovinaSeparatore problem
      mappedLine.push(tidyDescr);
      mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colCredit], this.decimalSeparator));
      mappedLine.push(Banana.Converter.toInternalNumberFormat(element[this.colDebit], this.decimalSeparator));

      return mappedLine;
   }

   this.wrapDescr = function (descr) {
      descr = descr.replace(/"/g, '\\\"');
      return '"' + descr + '"';
   }
}

function defineConversionParam(inData) {

   var inData = Banana.Converter.csvToArray(inData);
   var header = String(inData[0]);
   var convertionParam = {};
   /** SPECIFY THE SEPARATOR AND THE TEXT DELIMITER USED IN THE CSV FILE */
   convertionParam.format = "csv"; // available formats are "csv", "html"
   //get text delimiter
   convertionParam.textDelim = '"';
   // get separator
   if (header.indexOf(';') >= 0) {
      convertionParam.separator = ';';
   } else {
      convertionParam.separator = ',';
   }

   /** SPECIFY AT WHICH ROW OF THE CSV FILE IS THE HEADER (COLUMN TITLES)
   We suppose the data will always begin right away after the header line */
   convertionParam.headerLineStart = 5;
   convertionParam.dataLineStart = 6;

   /** SPECIFY THE COLUMN TO USE FOR SORTING
   If sortColums is empty the data are not sorted */
   convertionParam.sortColums = ["Date", "Doc"];
   convertionParam.sortDescending = false;

   return convertionParam;
}

function getFormattedData(inData, convertionParam, importUtilities) {
   var columns = importUtilities.getHeaderData(inData, convertionParam.headerLineStart); //array
   var rows = importUtilities.getRowData(inData, convertionParam.dataLineStart); //array of array
   let form = [];

   let convertedColumns = [];

   convertedColumns = convertHeaderDe(columns);
   //Load the form with data taken from the array. Create objects
   if (convertedColumns.length > 0) {
      importUtilities.loadForm(form, convertedColumns, rows);
      return form;
   }

   convertedColumns = convertHeaderFr(columns);
   if (convertedColumns.length > 0) {
      importUtilities.loadForm(form, convertedColumns, rows);
      return form;
   }

   return [];
}

function convertHeaderDe(columns) {
   let convertedColumns = [];

   for (let i = 0; i < columns.length; i++) {
      switch (columns[i]) {
         case "Valutadatum":
            convertedColumns[i] = "Date";
            break;
         case "Text":
            convertedColumns[i] = "Description";
            break;
         case "Gutschrift":
            convertedColumns[i] = "Income";
            break;
         case "Belastung":
            convertedColumns[i] = "Expenses";
            break;
         default:
            break;
      }
   }
   if (convertedColumns.indexOf("Date") < 0) {
      return [];
   }

   return convertedColumns;
}

function convertHeaderFr(columns) {
   let convertedColumns = [];

   for (let i = 0; i < columns.length; i++) {
      switch (columns[i]) {
         case "Date de valeur":
            convertedColumns[i] = "Date";
            break;
         case "Texte":
            convertedColumns[i] = "Description";
            break;
         case "Crédit":
            convertedColumns[i] = "Income";
            break;
         case "Débit":
            convertedColumns[i] = "Expenses";
            break;
         default:
            break;
      }
   }

   if (convertedColumns.indexOf("Date") < 0) {
      return [];
   }

   return convertedColumns;
}



