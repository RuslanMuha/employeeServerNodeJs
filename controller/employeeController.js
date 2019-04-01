const validate = require('../validation');
const Joi = require('joi');
const MODEL_PATH = '../model';
const Employee = require(MODEL_PATH + '/employee');
const Company = require(MODEL_PATH + '/company');


const schema = Joi.object().keys({
    id: Joi.number().required(),
    emailAddress: Joi.string().email().required(),
    companyName: Joi.string().required(),
    gender: Joi.string().required(),
    name: Joi.string().required(),
    salary: Joi.number().min(8000).max(40000).required(),
    title: Joi.string().required()


});


function throwError(message,httpCode,next) {
    const error = new Error(message);
    error.httpStatusCode = httpCode;
    return next(error);
}

function responseJSON(res,data,message) {
    res.status(200).json({
        status:'success',
        code:200,
        message:message,
        data:data
    });

}

exports.addEmployee = async (req, res,next) => {
    if(!validate(req, res, schema,next)){
        return;
    }
    req.body.emailAddress = req.body.emailAddress.toLowerCase();
    const employee = new Employee(req.body);
    const {companyName, salary, _id, id} = employee;


    if(!req.user){
        return throwError('authentication error',401,next);
    }
    try {
        await employee.save();

    } catch (e) {
        return throwError('failed to save',500,next);

    }
    try {
        const comp = await Company.findOne({companyName});
        if (!comp) {
            const company = new Company({companyName, salaryBudget: salary, quantity: 1});
            company.employees.peoples.push({id: employee._id});
            await company.save();
        } else {
            await Company.updateMany({companyName}, {
                $inc: {"salaryBudget": salary, "quantity": 1},
                $addToSet: {"employees.peoples": {id: _id}}
            });
        }
        responseJSON(res,[],'adding successfully');


    } catch (e) {

        await removeEmployee(id);

        return throwError('failed to save',500,next);


    }


};

exports.removeEmployeeFromCompany = async (req, res,next) => {
    const {id} = req.query;
    if (!id) {
        res.statusCode(400).send(false);
    }
    if(!req.user){
        return throwError('authentication error',401,next);

    }
    try {
        await remove(id);
        responseJSON(res,[],'removing successfully');
    } catch (e) {
        return throwError('failed to remove',500,next);
    }


};

async function remove(id) {

    const employee = await Employee.findOne({id});
    const {companyName, salary, _id} = employee;
    await Company.updateMany({companyName}, {
        $inc: {"salaryBudget": -salary, "quantity": -1},
        $pull: {"employees.peoples": {id: _id}}
    });

    const {quantity} = await Company.findOne({companyName});
    if (quantity === 0) {
        await Company.findOneAndDelete({companyName})
    }
    removeEmployee(id)

}

async function removeEmployee(id) {
    await Employee.findOneAndDelete({id});
}

exports.getEmployee = async (req, res,next) => {
    const {id} = req.query;
    if (!id) {
        return throwError('bad request',400,next);
    }
    try {
        const empl = await Employee.findOne({id});
        responseJSON(res,empl,'success');
    } catch (e) {
        return throwError('server error',500,next);
    }

};

exports.getEmployees = async (req, res,next) => {
    const result = {};
    try {
        const empls = await Employee.find().select('-__v -_id');
        for (let empl of empls) {
            result[empl.id] = empl;
        }
    } catch (e) {
        return throwError('server error',500,next);
    }

    responseJSON(res,result,'success');

};

exports.getCompany = async (req, res,next) => {
    const companyName = req.query.companyName;
    try {
        const company = await Company.findOne({companyName})
            .populate('employees.peoples.id');


        responseJSON(res,company,'success');

    } catch (e) {
       return throwError('server error',500,next);
    }

};
exports.getSalary = async (req, res,next) => {
    const companyName = req.query.companyName;
    try {
        const comp = await Company.findOne({companyName});
        responseJSON(res,comp.salaryBudget,'success');

    } catch (e) {
        return throwError('server error',500,next);
    }

};
