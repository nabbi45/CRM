// models/Counter.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const CounterSchema = new Schema({
  _id: { type: String },           // name of the counter, e.g. 'employeeId'
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', CounterSchema);

export default Counter;
