const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initilaizeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running At http://localhost:3000");
    });
  } catch (error) {
    console.log(`Error DB: ${error.message}`);
  }
};

initilaizeDBAndServer();

//middleware Function

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
    jwt.verify(jwtToken, "MYACCESS", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertStateArrayObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

// user login API

app.post("/login/", async (Request, Response) => {
  const { username, password } = Request.body;
  const selectUserQuery = `
    SELECT * FROM user
    WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    Response.status(400);
    Response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MYACCESS");
      Response.send({ jwtToken });
    } else {
      Response.status(400);
      Response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticateToken, async (Request, Response) => {
  const getListOfStateQuery = `
    SELECT * FROM state;`;
  const statesArray = await db.all(getListOfStateQuery);
  Response.send(statesArray.map((each) => convertStateArrayObject(each)));
});

app.get("/states/:stateId/", authenticateToken, async (Request, Response) => {
  const { stateId } = Request.params;
  const getstateQuery = `
  SELECT * FROM state
  WHERE state_id = '${stateId}';`;
  const state = await db.get(getstateQuery);
  Response.send(convertStateArrayObject(state));
});

app.post("/districts/", authenticateToken, async (Request, Response) => {
  const districtDetails = Request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
    INSERT INTO
    district(district_name,state_id,cases,cured,active,deaths)
    VALUES(
      '${districtName}',
      '${stateId}',
      '${cases}',
      '${cured}',
      '${active}',
      '${deaths}');`;
  await db.run(addDistrictQuery);
  Response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
  SELECT * FROM district WHERE district_id = ${districtId};`;
    const district = await db.get(getDistrictQuery);
    response.send(convertDistrictObject(district));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (Request, Response) => {
    const { districtId } = Request.params;
    const deleteDistrictQuery = `
    DELETE FROM district
    WHERE district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    Response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (Request, Response) => {
    const { districtId } = Request.params;
    const districtDetails = Request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateQuery = `
  UPDATE district
  SET
    district_name = '${districtName}',
    state_id = '${stateId}',
    cases = '${cases}',
    cured = '${cured}',
    active = '${active}',
    deaths = '${deaths}'
  WHERE district_id = ${districtId};`;
    await db.run(updateQuery);
    Response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (Request, Response) => {
    const { stateId } = Request.params;
    const getTotalActiveCaseAndDeaths = `
    SELECT
        SUM(cases),
        SUM(cured),
        SUM(active),
        SUM(deaths)
    FROM
        district
    WHERE 
        state_id = ${stateId};`;

    const state = await db.get(getTotalActiveCaseAndDeaths);
    Response.send({
      totalCases: state["SUM(cases)"],
      totalCured: state["SUM(cured)"],
      totalActive: state["SUM(active)"],
      totalDeaths: state["SUM(deaths)"],
    });
  }
);

module.exports = app;
