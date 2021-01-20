
const util = require("util");
const parse = require("csv").parse;
const parsePs = util.promisify(parse);
const fs = require("fs").promises;

const JOIN_PATH = "./csv/join20200619.csv";
const LINE_PATH = "./csv/line20200619free.csv";
const STATION_PATH = "./csv/station20200619free.csv";


const groupBy = (array, getKey) =>
  Array.from(
    array.reduce((map, cur, idx, src) => {
      const key = getKey(cur, idx, src);
      const list = map.get(key);
      if (list) list.push(cur);
      else map.set(key, [cur]);
      return map;
    }, new Map())
  );

// const groupBy = (array, getKey) =>
//   array.reduce((obj, cur, idx, src) => {
//     const key = getKey(cur, idx, src);
//     (obj[key] || (obj[key] = [])).push(cur);
//     return obj;
//   }, {});


const toGML = (station, join, line) =>{
  const lineCodes = line.map(item => item.line_cd);
  const filteredStations = station.filter(item => lineCodes.includes(item.line_cd));
  const stationGroup = groupBy(filteredStations, item => item.station_g_cd);

  console.log(filteredStations.length);
  console.log(station.length);

  const filteredJoins = join
    .filter(item => lineCodes.includes(item.line_cd))
    .map(item => {
      //駅グループコードに置換
      const sourceStation = filteredStations.find(station => station.station_cd === item.station_cd1);
      const targetStation = filteredStations.find(station => station.station_cd === item.station_cd2);


      if(!sourceStation || !targetStation){
        // console.log(item);
        return null;
      }

      item.station_cd1 = sourceStation.station_g_cd;
      item.station_cd2 = targetStation.station_g_cd;
      return item;
    })
    .filter(item => !!item);
  // console.log(toeiJoins);


  return `graph [
  directed 0
    ${stationGroup.map(([group, stations]) => `
      node [
        id ${group}
        label "${stations[0].station_name}"
      ]`).join("")}
    
    ${filteredJoins.map(item => `
      edge [
        source ${item.station_cd1}
        target ${item.station_cd2}
      ]`).join("")}
  ]
  `
}



(async () => {
  const parserOption = {
    delimiter: ",",
    columns: true
  }

  const station = await fs.readFile(STATION_PATH)
    .then(data => parsePs(data, parserOption));
  const join = await fs.readFile(JOIN_PATH)
    .then(data => parsePs(data, parserOption));
  const line = await fs.readFile(LINE_PATH)
    .then(data => parsePs(data, parserOption));

  //無料データには新幹線の駅がない
  const shinkansenRegex = /新幹線/;
  const validLine = line.filter(item => !shinkansenRegex.test(item.line_name));

  const validStation = station.filter(item => item.e_status === "0");
  const metropolitanStation = validStation.filter(item => ["11", "12", "13", "14"].includes(item.pref_cd));

  const result = toGML(metropolitanStation, join, validLine);

  fs.writeFile("metroNet.gml", result)
    .then(() => {
      console.log("complete");
    })
    .catch((err) => {
      console.error(err);
    })

  // console.log(result);

})();

