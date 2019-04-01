const Joi = require('joi');
const MODEL_PATH = '../model';
const bcrypt = require('bcryptjs');
const config = require('config');
const jwt = require('jsonwebtoken');
const User = require(MODEL_PATH + '/user');
const validate = require('../validation');
const nodemailer = require('nodemailer');
const sendGridTransport = require('nodemailer-sendgrid-transport');
const transporter = nodemailer.createTransport(sendGridTransport({
   auth:{
       api_key: config.get("api_key")
   }

}));

function throwError(message,httpCode,next) {
    const error = new Error(message);
    error.httpStatusCode = httpCode;
    return next(error);
}


const usersSchema = Joi.object().keys({
    email: Joi.string().email().normalize(),
    password: Joi.string().min(8).trim().required().strict(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).trim().required().strict().error(() => {
       return {message:"password do not match"}
    }),
    role: Joi.array().items(Joi.string().valid(['ADMIN', 'USER']))
});

exports.signup = async (req, res,next) => {
  if(!validate(req, res, usersSchema,next)){
      return;
  }

    delete req.body.confirmPassword;
    const {email} = req.body;
    try {

        let user = new User(req.body);
        await hashUserPassword(user);
        user = await user.save();
        transporter.sendMail({
            to: email,
            from:'employeeCompany@node.com',
            subject:'Sign up successful',
            html:'<h1>You successfully signed up! </h1>'
        });
        res.send(user)
    } catch (e) {
        return throwError('server error',500,next);
    }
};

exports.login = async (req,res,next)=>{

    if (!validate(req, res, usersSchema,next)) {
        return ;
    }
    const {email, password} = req.body;
    try {
        const user = await User.findOne({email});
        if (!user || !await checkUser(user, password)) {
            return throwError("authorization error",401,next);

        }
        res.send(getJwt(user));


    } catch (e) {
        return throwError("server error",500,next);
    }
};


async function checkUser(user, password) {
    return await bcrypt.compare(password,user.password);
}

function getJwt(user) {
    const secret = config.get('jwtSecret');
    if (!secret) {
        console.error("jwt secret isn't defined");
        process.exit(1);
    }
    return jwt.sign({_id:user._id},secret)
}
async function hashUserPassword(user) {
    user.password = await bcrypt.hash(user.password, 12)
}

