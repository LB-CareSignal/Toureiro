import express from 'express';
import bodyParser from 'body-parser';
import toureiro from '../lib/toureiro';

const mountedToureiro = toureiro({
  redis: {
    db: 1
  }
});

const app = express();

app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());

app.use('/toureiro', mountedToureiro);

app.listen(3000, function() {
  console.log('Server is now listening at port 3000...');
});