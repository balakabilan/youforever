require("dotenv").config();
const PORT = process.env.PORT || 3000;

//Express
const express = require("express");
const app = express();
const bcrypt = require('bcrypt');
let flash = require("connect-flash");

const mongodb = require("mongodb");
let MongoClient = mongodb.MongoClient;
const MONGO_URI = process.env.MONGO_URI;
const session = require("express-session");
var MongoDBStore = require("connect-mongodb-session")(session);
const objectId = mongodb.ObjectID;

//Passport
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

app.use(express.static(__dirname + "/assets"));
app.use(express.json());
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
let store = new MongoDBStore({
  uri: MONGO_URI,
  collection: "gymsessions",
});

store.on("error", (error) => {
  console.log(error);
});

app.use(
  session({
    secret: "secretText",
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    },
    saveUninitialized: true,
    resave: true,
    store: store,
  })
);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

//Local Strategy
passport.use(
  new LocalStrategy(
    { usernameField: "email", passReqToCallback: true },
    function (req, username, password, done) {
      MongoClient.connect(
        MONGO_URI,
        { useNewUrlParser: true, useUnifiedTopology: true },
        function (err, client) {
          if (err) throw err;
          let db = client.db("testDB");
          let col = db.collection("gymuser");
          col.findOne({ email: username }, function (error, user) {
            if (error) {
              client.close();
              return done(error);
            }
            if (!user) {
              client.close();
              return done(null, false, req.flash("message", "Incorrect Email"));
            }
            if (!bcrypt.compareSync(password, user.password)) {
              client.close();

              return done(
                null,
                false,
                req.flash("message", "Incorrect Password")
              );
            }
            client.close();
            return done(null, user);
          });
        }
      );
    }
  )
);

passport.serializeUser(function (user, done) {
  done(null, user._id);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

function checkAuth(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    let data = req.flash("message")[0];
    res.render(__dirname + "/public/login", {
      message: data,
    });
  }
}

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/register", (req, res) => {
  res.sendFile(__dirname + "/public/register.html");
});

app.get("/login", checkAuth, (req, res) => {
  res.redirect("/dashboard/" + req.user);
});

app.get("/dashboard/:id", checkAuth, (req, res) => {
  res.sendFile(__dirname + "/public/dashboard.html");
});

app.post("/register", (req, res) => {
  let ePassword = bcrypt.hashSync(req.body.password, 10);
  let data = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    password: ePassword,
  };
  MongoClient.connect(
    MONGO_URI,
    { useNewUrlParser: true, useUnifiedTopology: true },
    function (err, client) {
      if (err) throw err;
      let db = client.db("testDB");
      let col = db.collection("gymuser");
      col.insertOne(data, function (error, success) {
        if (error) throw error;
        console.log("inserted ");
        res.render(__dirname + "/public/login", { message: 'Registration was succesful. You can Login now'} );
        client.close();
      });
    }
  );
});

// app.post(
//   "/login",
//   passport.authenticate("local", {
//     successRedirect: "/dashboard",
//     failureRedirect: "/login",
//     // session: false,
//   })
// );

app.post(
  "/login",
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  function (req, res) {
    res.redirect("/dashboard/" + req.user._id);
  }
);

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/user/:id", (req, res) => {
  MongoClient.connect(
    MONGO_URI,
    { useNewUrlParser: true, useUnifiedTopology: true },
    function (err, client) {
      if (err) throw err;
      let id = req.params.id;
      let db = client.db("testDB");
      let col = db.collection("gymuser");
      id = new objectId(id);
      col.findOne({ _id: id }, function (e, user) {
        if (e) throw e;
        res.json(user);
        client.close();
      });
    }
  );
});

app.listen(PORT);
