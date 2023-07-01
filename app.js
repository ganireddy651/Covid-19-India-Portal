const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running At http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};

initializeDBAndServer();

// Loin API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const searchUserQuery = `SELECT * FROM user WHERE username = "${username}"`;
  const dbUser = await db.get(searchUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatched === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "jkhdsjfewhfw");
      response.send({ jwtToken: jwtToken });
    }
  }
});

// Authentication with Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "jkhdsjfewhfw", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// GET States API
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state`;
  const dbResponse = await db.all(getStatesQuery);
  const output = dbResponse.map((each) => ({
    stateId: each.state_id,
    stateName: each.state_name,
    population: each.population,
  }));
  response.send(output);
});

// GET State API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId}`;
  const dbResponse = await db.get(getStateQuery);
  response.send({
    stateId: dbResponse.state_id,
    stateName: dbResponse.state_name,
    population: dbResponse.population,
  });
});

// Create District API
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const createDistrictQuery = `INSERT INTO 
  district (district_name,state_id,cases,cured,active,deaths) 
  VALUES("${districtName}",${stateId},${cases},${cured},${active},${deaths})`;
  const dbResponse = await db.run(createDistrictQuery);
  const newDistrictId = dbResponse.lastID;
  response.send("District Successfully Added");
});

// GET District API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `SELECT * FROM district WHERE district_id=${districtId}`;
    const dbResponse = await db.get(getDistrictQuery);
    response.send({
      districtId: dbResponse.district_id,
      districtName: dbResponse.district_name,
      stateId: dbResponse.state_id,
      cases: dbResponse.cases,
      cured: dbResponse.cured,
      active: dbResponse.active,
      deaths: dbResponse.deaths,
    });
  }
);

// Delete District API
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId}`;
    const dbResponse = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// Update District API
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const updateDistrictDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = updateDistrictDetails;
    const updateQuery = `UPDATE district SET 
  district_name="${districtName}",state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} WHERE district_id = ${districtId}`;
    const dbResponse = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

// GET State
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `SELECT SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths FROM district WHERE state_id = ${stateId}`;
    const dbResponse = await db.get(statsQuery);
    response.send(dbResponse);
  }
);

module.exports = app;
