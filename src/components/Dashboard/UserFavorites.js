import React from 'react';
import Modal from 'react-bootstrap/Modal';
import { useDispatch, useSelector } from 'react-redux';
// import SpotifyWebApi from 'spotify-web-api-node';
import { setShow } from '../../redux/reducers';
import { store } from '../../redux/store';
import UserTopTracks from '../UserTopTracks';
import classes from './UserFavorites.module.css';

function UserFavorites() {
  const dispatch = useDispatch();

  const show = store.getState().accessToken.show;

  const { userTopTracks } = useSelector((state) => state.userTopTracks);

  const handleClose = () => dispatch(setShow(false));
  const handleShow = () => dispatch(setShow(true));

  return (
    <div className={classes.contentcard}>
      <div className={classes.cardfront}>
        <div className={classes.title}>
          <span>F</span>
          <span>A</span>
          <span>V</span>
          <span>O</span>
          <span>R</span>
          <span>I</span>
          <span>T</span>
          <span>E</span>
          <span>S</span>
        </div>
        <div className={classes.collage}>
          {userTopTracks.map((tracks) => (
            <div className={classes.frontimage} key={tracks.id}>
              <img src={tracks.album.images[0].url} alt="" onClick={handleShow} />
            </div>
          ))}
        </div>
      </div>

      <div className={classes.test}>
        <UserTopTracks />
      </div>
      <Modal show={show} onHide={handleClose}>
        <Modal.Body>Woohoo, you're reading this text in a modal!</Modal.Body>
      </Modal>
    </div>
  );
}

export default UserFavorites;
