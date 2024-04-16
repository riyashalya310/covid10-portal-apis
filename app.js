const express = require("express");
const app = express();
app.use(express.json());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      driver: sqlite3.Database,
      filename: dbPath,
    });

    app.listen(3000, (request, response) => {
      console.log("server is running");
    });
  } catch (e) {
    console.log(`error -> ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const ifUserExists = `
   SELECT * FROM user
   WHERE username='${username}'
  `;
  const user = await db.get(ifUserExists);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    if (await bcrypt.compare(user.password, password)) {
      const userDetails = {
        username,
      };
      const jwtToken = jwt.sign(userDetails, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = async (request, response, next) => {
  let jwtToken;
  const auth = request.headers["authorization"];
  if (auth !== undefined) {
    jwtToken = auth.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/states/", authenticateToken, async (request, response) => {
  const query = `
    SELECT * FROM state
    `;
  const responseArr = await db.all(query);
  response.send(
    responseArr.map((item) => ({
      stateId: item.state_id,
      stateName: item.state_name,
      population: item.population,
    }))
  );
});

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const query = `
  SELECT * FROM state
  WHERE state_id='${stateId}'
  `;
  const responseArr = await db.get(query);
  response.send({
    stateId: responseArr.state_id,
    stateName: responseArr.state_name,
    population: responseArr.population,
  });
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const query = `
  INSERT INTO DISTRICT (district_name,state_id,cases,cured,active,deaths)
  VALUES(
      '${districtName}',
      ${stateId},
      ${cases},
      ${cured},
      ${active},
      ${deaths}
  );
  `;
  await db.run(query);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `
    SELECT * FROM district
    WHERE district_id='${districtId}'
    `;
    const responseArr = await db.get(query);
    response.send({
      districtId: responseArr.district_id,
      districtName: responseArr.district_name,
      stateId: responseArr.state_id,
      cases: responseArr.cases,
      cured: responseArr.cured,
      active: responseArr.active,
      deaths: responseArr.deaths,
    });
  }
);

app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `
    DELETE FROM district
    WHERE district_id='${districtId}'
    `;
    await db.run(query);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const query = `
    UPDATE district 
    SET district_name='${districtName}', state_id='${stateId}',cases=${cases},cured=${cured}
     active=${active}, deaths=${deaths}
    WHERE district_id='${districtId}'
    `;
    await db.run(query);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const query = `
    SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured, SUM(active) AS totalActive,SUM(deaths) AS totalDeaths
    FROM district 
    GROUP BY state_id
    HAVING state_id='${stateId}'
    `;
    const responseArr = await db.get(query);
    response.send({
      totalCases: responseArr.totalCases,
      totalCured: responseArr.totalCured,
      totalActive: responseArr.totalActive,
      totalDeaths: responseArr.totalDeaths,
    });
  }
);

module.exports = app;
