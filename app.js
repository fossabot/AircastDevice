var async = require("async");
var needle = require("needle");
var fs = require("fs");
var bodyParser = require("body-parser");
var express = require("express");
var path = require("path");
var aircast = require("./aircastServer.js");
var programmaticImage = require("./programmatic-image.js");
var programmaticVideo = require("./programmatic-video.js");
var moment = require("moment");
var request = require("request");
var LocalStorage = require("node-localstorage").LocalStorage;

var offline = true;

var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set("port", process.env.PORT || 3000);
app.use("/css", express.static(path.join(__dirname + "/public/css")));
app.use("/scripts", express.static(path.join(__dirname + "/public/scripts")));
app.use(
  "/templates",
  express.static(path.join(__dirname + "/public/templates"))
);
app.use("/assets", express.static(path.join(__dirname + "/public/assets")));
app.use(
  "/Aircast",
  express.static(path.join(__dirname + "/../AircastContent"))
);

app.get("/", function(req, res) {
  res.sendFile("index.html", { root: path.join(__dirname, "/public") });
});

app.get("/demo", function(req, res) {
  res.sendFile("indexDemo.html", { root: path.join(__dirname, "/public") });
});

app.get("/demoPortrait", function(req, res) {
  res.sendFile("indexDemoPortrait.html", {
    root: path.join(__dirname, "/public")
  });
});

app.get("/crash", function(req, res) {
  setTimeout(function() {
    throw new Error("We crashed!!!!!");
  }, 10);
  res.sendFile("indexDemoPortrait.html", {
    root: path.join(__dirname, "/public")
  });
});

if (typeof localStorage === "undefined" || localStorage === null) {
  localStorage = new LocalStorage("./scratch");
}

app.get("/myID", function(req, res) {
  // console.log(aircast);
  var data = {
    RpiID: aircast.config.RpiID,
    RpiServer: aircast.config.RpiServer
  };

  if (aircast.config.isLegit) {
    res.send(data);
  } else {
    res.send({
      error: "config failed"
    });
  }
});

app.post("/logTimestamp", (req, res) => {
  let d = req.body;

  if (d.Status == "online") {
    if (offline) {
      let results = [];

      fs.exists(__dirname + "/scratch/logs.txt", function(exists) {
        if (exists) {
          fs.readFile(__dirname + "/scratch/logs.txt", "utf8", function(
            err,
            data
          ) {
            if (err) throw err;

            let x = data.slice(0, -1);
            let y = data.split("*");

            for (let i = 0; i < y.length - 1; i++) {
              let a = y[i].split(",");
              let z = [parseInt(a[0]), parseInt(a[1]), a[2]];

              results.push(z);
            }

            var options = {
              url: "http://13.250.103.104:3500/api/postTimestamp",
              method: "POST",
              json: { data: results }
            };

            request(options, function(error, response, body) {
              if (error) {
              } else {
                try {
                  if (response.body.success) {
                    fs.truncate(__dirname + "/scratch/logs.txt", 0, function() {
                      console.log("emptied the logs");
                    });
                    console.log("updated");
                    offline = false;
                  }
                } catch (e) {
                  offline = false;
                }
              }
            });
          });
        }
      });
    }
  } else {
    let d = req.body;
    var stream = fs.createWriteStream(__dirname + "/scratch/logs.txt", {
      flags: "a"
    });

    let t = moment().format("YYYY-MM-DD HH:mm:ss");

    let data = [aircast.config.RpiID, d.CampaignID, t];

    stream.write(data.toString() + "*");

    stream.end();

    offline = true;
  }
});

app.post("/localContent", function(req, res) {
  let d = req.body;
  let results;
  try {
    if (d.status) {
      localStorage.setItem("data", JSON.stringify(d.content));
      res.json({ success: true });
    } else {
      results = localStorage.getItem("data");
      if (results == null) {
        res.json({ success: true, content: [] });
      } else {
        res.json({ success: true, content: JSON.parse(results) });
      }
    }
  } catch (err) {}
});

app.get("/get-programmatic-campaign/image/:CampaignID", (req, res) => {
  // GET PROGRAMMATIC CONFIGURATION (ADM) TO BE RENDER ON PROGRAMMATIC PAGE
  const CampaignID = req.params.CampaignID;
  programmaticImage.get(CampaignID, result => {
    res.status(200).json(result);
  });
});

app.get("/update_programmatic/image/:CampaignID", (req, res) => {
  // DISABLE PROGRAMMATIC CAMPAIGN AFTER RENDERING
  const CampaignID = req.params.CampaignID;
  programmaticImage.disable(CampaignID, result => {
    console.log(`Programmatic Campaign ID: ${CampaignID} off.`);
    res.status(200).json(result);
  });
});

app.get("/get-programmatic-campaign/video/:CampaignID", (req, res) => {
  // GET PROGRAMMATIC CONFIGURATION (ADM) TO BE RENDER ON PROGRAMMATIC PAGE
  const CampaignID = req.params.CampaignID;
  programmaticVideo.get(CampaignID, result => {
    var data = JSON.parse(result);
    res.status(200).send(data.seatbid[0].bid[0].adm);
  });
});

app.get("/update_programmatic/video/:CampaignID", (req, res) => {
  // DISABLE PROGRAMMATIC CAMPAIGN AFTER RENDERING
  const CampaignID = req.params.CampaignID;
  programmaticVideo.disable(CampaignID, result => {
    console.log(`Programmatic Campaign ID: ${CampaignID} off.`);
    res.status(200).json(result);
  });
});

app.listen(app.get("port"), function() {
  console.log("Example app listening on port: " + app.get("port"));
  // getProgrammaticConfig();
});

function getRpiConfig() {
  if (aircast.getConfig()) {
    //console.log('success');
    // updateRpi();
    setInterval(aircast.getRpiFiles, 10000);
    setInterval(aircast.getSourceFiles, 30000);
    setInterval(aircast.nodeAlive, 30000);
    // setInterval(aircast.removeFile, 5000);
  } else {
    // console.log('fail');
    setTimeout(getRpiConfig, 1000);
  }
}

function updateRpi() {
  setInterval(aircast.getRpiFiles, 10000);
}

getRpiConfig();

// PROGRAMMATIC FEATURE IS TEMPORARILY DISABLED TO PREVENT CRASHING DUE TO
// OUTDATED CODES AND RESPONSE HANDLER
/*
programmaticImage.check(CampaignIDs => {
  // CALL PROGRAMMATIC IN APPLICATION START
  if (CampaignIDs.length > 0) {
    for (var i = 0; i < CampaignIDs.length; i++) {
      programmaticImage.initialize(CampaignIDs[i].CampaignID, result => {
        if (result.has_data) {
          console.log(result);
        } else {
          console.log(result.data);
        }
      });
    }
  } else {
    console.log("No programmatic image campaign.");
  }
});

setInterval(function() {
  // CALL PROGRAMMATIC EVERY 30 SECONDS
  programmaticImage.check(CampaignIDs => {
    if (CampaignIDs.length > 0) {
      for (var i = 0; i < CampaignIDs.length; i++) {
        programmaticImage.initialize(CampaignIDs[i].CampaignID, result => {
          console.log(result);
        });
      }
    } else {
      console.log("No programmatic image campaign.");
    }
  });
}, 30000);

programmaticVideo.check(CampaignIDs => {
  // CALL PROGRAMMATIC IN APPLICATION START
  if (CampaignIDs.length > 0) {
    for (var i = 0; i < CampaignIDs.length; i++) {
      programmaticVideo.initialize(CampaignIDs[i].CampaignID, result => {
        if (result.has_data) {
          console.log(result);
        } else {
          console.log(result.data);
        }
      });
    }
  } else {
    console.log("No programmatic video campaign.");
  }
});

setInterval(function() {
  // CALL PROGRAMMATIC EVERY 30 SECONDS
  programmaticVideo.check(CampaignIDs => {
    if (CampaignIDs.length > 0) {
      for (var i = 0; i < CampaignIDs.length; i++) {
        programmaticVideo.initialize(CampaignIDs[i].CampaignID, result => {
          console.log(result);
        });
      }
    } else {
      console.log("No programmatic video campaign.");
    }
  });
}, 30000);
*/
