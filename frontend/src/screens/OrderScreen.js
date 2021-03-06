import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PayPalButton } from 'react-paypal-button-v2';
import { Link } from 'react-router-dom';
import { Row, Col, ListGroup, Image, Card, Button } from 'react-bootstrap';
import { useDispatch, useSelector } from 'react-redux';
import Message from '../components/Message';
import Loader from '../components/Loader';
import {
  getOrderDetails,
  payOrder,
  deliverOrder,
} from '../actions/orderActions';
import {
  ORDER_PAY_RESET,
  ORDER_DELIVER_RESET,
} from '../constants/orderConstants';

const OrderScreen = ({ match, history }) => {
  const orderId = match.params.id;

  const [sdkReady, setSdkReady] = useState(false);

  const dispatch = useDispatch();
  const [razorpayKeyId, setRazorpayKeyId] = useState('1');
  const orderDetails = useSelector((state) => state.orderDetails);
  const { order, loading, error } = orderDetails;

  const orderPay = useSelector((state) => state.orderPay);
  const { loading: loadingPay, success: successPay } = orderPay;

  const orderDeliver = useSelector((state) => state.orderDeliver);
  const { loading: loadingDeliver, success: successDeliver } = orderDeliver;

  const userLogin = useSelector((state) => state.userLogin);
  const { userInfo } = userLogin;

  if (!loading) {
    //   Calculate prices
    const addDecimals = (num) => {
      return (Math.round(num * 100) / 100).toFixed(2);
    };

    order.itemsPrice = addDecimals(
      order.orderItems.reduce((acc, item) => acc + item.price * item.qty, 0)
    );
  }

  useEffect(() => {
    if (!userInfo) {
      history.push('/login');
    }

    const addRazorpayScript = async (src) => {
      const { data: keyId } = await axios.get('/api/config/razorpay');
      setRazorpayKeyId(keyId);
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = src;
      script.async = true;
      script.onload = () => {
        setSdkReady(true);
      };
      document.body.appendChild(script);
    };

    const addPayPalScript = async () => {
      const { data: clientId } = await axios.get('/api/config/paypal');
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}`;
      script.async = true;
      script.onload = () => {
        setSdkReady(true);
      };
      document.body.appendChild(script);
    };

    if (!order || successPay || successDeliver || order._id !== orderId) {
      dispatch({ type: ORDER_PAY_RESET });
      dispatch({ type: ORDER_DELIVER_RESET });
      dispatch(getOrderDetails(orderId));
    } else if (!order.isPaid && order.paymentMethod === 'PayPal') {
      if (!window.paypal) {
        addPayPalScript();
      } else {
        setSdkReady(true);
      }
    } else if (!order.isPaid && order.paymentMethod === 'Razorpay') {
      if (!window.Razorpay) {
        addRazorpayScript('https://checkout.razorpay.com/v1/checkout.js');
      } else {
        setSdkReady(true);
      }
    }
  }, [
    dispatch,
    orderId,
    successPay,
    successDeliver,
    order,
    history,
    userInfo,
    razorpayKeyId,
  ]);

  const displayRazorpay = async () => {
    const config = {
      totalAmount: order.totalPrice,
      currency: 'INR',
      orderId: order._id,
    };

    // creating a new order
    const result = await axios.post('/api/payment/razorpay', config);
    if (!result) {
      return;
    }

    // Getting the order details back
    const { amount, id: order_id, currency } = result.data;

    const options = {
      key: 'rzp_test_WiuOsLFk5R5caw', // Enter the Key ID generated from the Dashboard
      amount: amount.toString(),
      currency: currency,
      name: userInfo.name,
      description: 'Order Transaction',
      image: '/favicon-48x48.png',
      order_id: order_id,
      handler: async function (response) {
        // On Transaction Success
        const data = {
          id: orderId,
          // razorpayPaymentId: response.razorpay_payment_id,
          // razorpayOrderId: response.razorpay_order_id,
          // razorpaySignature: response.razorpay_signature,
          // id: response.razorpay_payment_id,
          status: true,
          update_time: Date.now().toString(),
          payer: { email_address: userInfo.email },
        };
        dispatch(payOrder(orderId, data));
      },
      prefill: {
        name: userInfo.name,
        email: userInfo.email,
      },
      notes: {
        address: 'India',
      },
      theme: {
        color: '#61dafb',
      },
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.on('payment.failed', function (response) {
      // On Transaction Failure
      // alert(response.error.code);
      alert(`Transaction Failed ${response.error.code}`);
      // alert(response.error.description);
      // alert(response.error.source);
      // alert(response.error.step);
      // alert(response.error.reason);
      // alert(response.error.metadata.order_id);
      // alert(response.error.metadata.payment_id);
    });
    paymentObject.open();
  };

  const successPaymentHandler = (paymentResult) => {
    // console.log(paymentResult);
    dispatch(payOrder(orderId, paymentResult));
  };

  const deliverHandler = () => {
    dispatch(deliverOrder(order));
  };

  return loading ? (
    <Loader />
  ) : error ? (
    <Message variant='danger'>{error}</Message>
  ) : (
    <>
      <h1>Order {order._id}</h1>
      <Row>
        <Col md={8}>
          <ListGroup variant='flush'>
            <ListGroup.Item>
              <h2>Shipping</h2>
              <p>
                <strong>Name: </strong> {order.user.name}
              </p>
              <p>
                <strong>Email: </strong>{' '}
                <a href={`mailto:${order.user.email}`}>{order.user.email}</a>
              </p>
              <p>
                <strong>Address: </strong>
                {order.shippingAddress.address}, {order.shippingAddress.city}{' '}
                {order.shippingAddress.postalCode},{' '}
                {order.shippingAddress.country}
              </p>
              {order.isDelivered ? (
                <Message variant='success'>
                  Delivered on {order.deliveredAt}
                </Message>
              ) : (
                <Message variant='danger'>Not Delivered</Message>
              )}
            </ListGroup.Item>

            <ListGroup.Item>
              <h2>Payment Method</h2>
              <p>
                <strong>Method: </strong>
                {order.paymentMethod}
              </p>
              {order.isPaid ? (
                <Message variant='success'>Paid on {order.paidAt}</Message>
              ) : (
                <Message variant='danger'>Not Paid</Message>
              )}
            </ListGroup.Item>

            <ListGroup.Item>
              <h2>Order Items</h2>
              {order.orderItems.length === 0 ? (
                <Message>Order is empty</Message>
              ) : (
                <ListGroup variant='flush'>
                  {order.orderItems.map((item, index) => (
                    <ListGroup.Item key={index}>
                      <Row>
                        <Col md={1}>
                          <Image
                            src={item.image}
                            alt={item.name}
                            fluid
                            rounded
                          />
                        </Col>
                        <Col>
                          <Link to={`/product/${item.product}`}>
                            {item.name}
                          </Link>
                        </Col>
                        <Col md={4}>
                          {item.qty} x ???{item.price} = ???{item.qty * item.price}
                        </Col>
                      </Row>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </ListGroup.Item>
          </ListGroup>
        </Col>
        <Col md={4}>
          <Card>
            <ListGroup variant='flush'>
              <ListGroup.Item>
                <h2>Order Summary</h2>
              </ListGroup.Item>
              <ListGroup.Item>
                <Row>
                  <Col>Items</Col>
                  <Col>???{order.itemsPrice}</Col>
                </Row>
              </ListGroup.Item>
              <ListGroup.Item>
                <Row>
                  <Col>Shipping</Col>
                  <Col>???{order.shippingPrice}</Col>
                </Row>
              </ListGroup.Item>
              <ListGroup.Item>
                <Row>
                  <Col>Tax</Col>
                  <Col>???{order.taxPrice}</Col>
                </Row>
              </ListGroup.Item>
              <ListGroup.Item>
                <Row>
                  <Col>Total</Col>
                  <Col>???{order.totalPrice}</Col>
                </Row>
              </ListGroup.Item>
              {!order.isPaid && order.paymentMethod === 'PayPal' && (
                <ListGroup.Item>
                  {loadingPay && <Loader />}
                  {!sdkReady ? (
                    <Loader />
                  ) : (
                    <PayPalButton
                      amount={order.totalPrice}
                      onSuccess={successPaymentHandler}
                    />
                  )}
                </ListGroup.Item>
              )}
              {!order.isPaid && order.paymentMethod === 'Razorpay' && (
                <ListGroup.Item>
                  {loadingPay && <Loader />}
                  {!sdkReady ? (
                    <Loader />
                  ) : (
                    <Button
                      className='btn-block'
                      type='button'
                      variant='primary'
                      onClick={displayRazorpay}
                    >
                      PAY NOW
                    </Button>
                  )}
                </ListGroup.Item>
              )}
              {loadingDeliver && <Loader />}
              {userInfo &&
                userInfo.isAdmin &&
                order.isPaid &&
                !order.isDelivered && (
                  <ListGroup.Item>
                    <Button
                      type='button'
                      className='btn btn-block'
                      onClick={deliverHandler}
                    >
                      Mark As Delivered
                    </Button>
                  </ListGroup.Item>
                )}
            </ListGroup>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default OrderScreen;
