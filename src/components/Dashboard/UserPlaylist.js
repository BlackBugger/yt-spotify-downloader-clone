import Modal from 'react-bootstrap/Modal';
import { useDispatch, useSelector } from 'react-redux';
import { setShow } from '../../redux/reducers';
import { store } from '../../redux/store';
import UserTopPlaylist from '../UserTopPlaylist';

import classes from './UserPlaylist.module.css';

function UserPlaylist() {
  const dispatch = useDispatch();

  const show = store.getState().accessToken.show;

  const { userPlaylist } = useSelector((state) => state.userPlaylist);

  const handleClose = () => dispatch(setShow(false));
  const handleShow = () => dispatch(setShow(true));

  return (
    <div className={classes.contentcard}>
      <div className={classes.test}>
        <UserTopPlaylist />
      </div>
      <div className={classes.cardfront}>
        <div className={classes.title}>
          <span>P</span>
          <span>L</span>
          <span>A</span>
          <span>Y</span>
          <span>L</span>
          <span>I</span>
          <span>S</span>
          <span>T</span>
          <span>S</span>
        </div>
        <div className={classes.collage}>
          {userPlaylist.map((track) => (
            <div className={classes.frontimage} key={track.id}>
              <img src={track.images[0].url} alt="" onClick={handleShow} />
            </div>
          ))}
        </div>
      </div>

      <Modal show={show} onHide={handleClose}>
        <Modal.Body>Woohoo, you're reading this text in a modal!</Modal.Body>
      </Modal>
    </div>
  );
}

export default UserPlaylist;
