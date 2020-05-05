
import React from 'react';
import { Row, Col, ListGroup, Form, Button, ButtonGroup, Modal } from 'react-bootstrap';
import axios from 'axios';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'

import UserType from './UserType';
import PartOfSpeech from './PartOfSpeech';
import cookie from 'react-cookies';

import { remove_punctuation } from './helpers';

const { REACT_APP_API_URL } = process.env;

const api = axios.create({
    baseURL: REACT_APP_API_URL,
});

class WordWindow extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            word: null,
            text: null,
            part_of_speech: null,
            definition: null,
            suggestedSentences: [],
            sentencesUpdates: {},
        };
    }

    componentDidMount() {
        this.getWord();
    }

    getWord() {
        api.get('/api/word/' + this.props.wordId, {
            headers: {signed_request: cookie.load('signed_request')},
        }).then(res => {
            if (res.status == 200) {
                this.setState({word: res.data.result});
                this.getSuggestedSentences(res.data.result);
            } else {
                console.log(res.status, res.data);
            }
        }).catch(err => {
            console.error(err);
            this.setState({word: false});
        });
    }
   
    getSuggestedSentences(word) {
        api.get('/api/search/sentence', {
            headers: {signed_request: cookie.load('signed_request')},
            params: {
                query: remove_punctuation(word.text),
                language: 'paiute',
                mode: 'contains',
            }
        }).then(res => {
            if (res.status == 200) {
                if (res.data.result) {
                    this.setState({suggestedSentences: res.data.result})
                }
            } else {
                console.log(res.status, res.data);
            }
        }).catch(err => console.error(err));
    }

    /**
     * 
     * @param {String} e 
     */
    changePartOfSpeech(part_of_speech) {
        this.setState({part_of_speech: part_of_speech.toUpperCase().replace(' ', '_')});
    }

    /**
     * 
     * @param {String} text 
     */
    changeWordText(text) {
        this.setState({text: text});
    }

    /**
     * 
     * @param {String} text 
     */
    changeDefinition(definition) {
        this.setState({definition: definition});
    }

    getDeleteSentenceModal() {
        let { sentenceToRemove } = this.state;

        let body;
        if (sentenceToRemove != null) {
            body = (
                <div>
                    <b>{sentenceToRemove.english}</b>
                    <p>{sentenceToRemove.paiute}</p>
                </div>
            );
        }
        
        return (
            <Modal 
                show={sentenceToRemove != null} 
                onHide={() => this.setState({sentenceToRemove: null})}
            >
                <Modal.Header closeButton>
                    <Modal.Title>
                        Are you sure?
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {body}
                </Modal.Body>
                <Modal.Footer>
                    <Button 
                        variant='outline-primary' 
                        onClick={() => this.setState({sentenceToRemove: null})}>
                    Close
                    </Button>
                    <Button 
                        variant='outline-danger' 
                        onClick={() => this.removeSentence(sentenceToRemove._id, () => {
                            this.setState({sentenceToRemove: null});
                            this.getWord();
                        })}
                    >
                        <FontAwesomeIcon icon={faTrash} className='mr-2' />
                        Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }

    saveWord(next) { 
        if (!this.canEdit()) {
            console.error("This user cannot make edits!")
            return;
        }

        let { text, part_of_speech, definition } = this.state;
        let body = {};
        if (text != null) body.text = text;
        if (part_of_speech != null) body.part_of_speech = part_of_speech;
        if (definition != null) body.definition = definition;

        if (Object.keys(body).length <= 0) return next(); // no update
        api.put('/api/word/' + this.props.wordId, 
            body, 
            {headers: {signed_request: cookie.load('signed_request')}}
        ).then(res => {
            if (res.status == 200) {
                next();
            } else {
                console.log(res.status, res.data);
            }
        }).catch(err => console.error(err));
    }

    saveSentence(sentenceId, next) { 
        if (!this.canEdit()) {
            console.error("This user cannot make edits!")
            return;
        }

        let { sentencesUpdates } = this.state;
        if (sentencesUpdates[sentenceId] == null) return next(); // No update
        let body = {};
        if (sentencesUpdates[sentenceId].paiute) body.paiute = sentencesUpdates[sentenceId].paiute;
        if (sentencesUpdates[sentenceId].english) body.english = sentencesUpdates[sentenceId].english;
        if (!body) return next(); // No update
        api.put('/api/sentence/' + sentenceId,
            body,
            {headers: {signed_request: cookie.load('signed_request')}}
        ).then(res => {
            if (res.status == 200) {
                return next();
            } else {
                console.log(res.status, res.data);
            }
        }).catch(err => console.error(err));
        
    }

    removeSentence(sentenceId, next) {
        if (sentenceId == null) return;
        api.delete('/api/sentence/' + sentenceId, 
            {headers: {signed_request: cookie.load('signed_request')}}
        ).then(res => {
            if (res.status == 200) {
                return next();
            } else {
                console.log(res.status, res.data);
            }
        }).catch(err => console.error(err));
    }

    canEdit() {
        let user = this.props.getUser();
        if (user != null && UserType[user.type] != null && UserType[user.type] >= UserType.EDITOR) {
            return true;
        }
        return false;
    }

    /**
     * 
     * @param {String} sentenceId 
     * @param {String} value 
     */
    changeSentence(language, sentenceId, value) {
        let { sentencesUpdates } = this.state;
        if (!sentencesUpdates[sentenceId]) {
            sentencesUpdates[sentenceId] = {}
        }
        sentencesUpdates[sentenceId][language] = value;
        this.setState({sentencesUpdates: sentencesUpdates});
    }

    sentenceForm(sentence, i) {
        let hasChanged = this.hasSentenceChanged(sentence._id);
        return (
            <Form>

                <Form.Group controlId={`form-sentence-paiute-${i}`}>
                    <Form.Label>Paiute</Form.Label>
                    <Form.Control as="textarea" defaultValue={sentence.paiute} 
                        onChange={e => this.changeSentence('paiute', sentence._id, e.target.value)}
                    />
                </Form.Group>

                <Form.Group controlId={`form-sentence-english-${i}`}>
                    <Form.Label>English</Form.Label>
                    <Form.Control as="textarea" defaultValue={sentence.english} 
                        onChange={e => this.changeSentence('english', sentence._id, e.target.value)}
                    />
                </Form.Group>

                <ButtonGroup className='d-flex'>
                    <Button 
                        variant={hasChanged ? 'outline-primary' : 'outline-secondary'} 
                        href='#'
                        className='w-100'
                        disabled={!hasChanged}
                        onClick={e => this.saveSentence(sentence._id, () => this.getWord())}
                    >
                        Save
                    </Button>
                    <Button 
                        variant='outline-danger' href='#'
                        className='w-25'
                        onClick={e => {
                            this.setState({sentenceToRemove: sentence});
                        }}
                    >
                        <FontAwesomeIcon icon={faTrash} className='mr-2' />
                        Delete
                    </Button>
                </ButtonGroup>
                

            </Form>
        );
    }

    sentenceSimple(sentence, id) {
        return (
            <div>
                <b>{sentence.english}</b>
                <p>{sentence.paiute}</p>
            </div>  
        );
    }
    
    wordForm(word) {
        let part_of_speech_option = word.part_of_speech.toLowerCase().replace('_', ' ');
        let posOptions = PartOfSpeech.map((part_of_speech, i) => {
            let pos = part_of_speech.toLowerCase().replace('_', ' ');
            return (
                <option key={'option-pos-' + i}>{pos}</option>
            );
        });
        let hasChanged = this.hasTextChanged() || this.hasPosChanged() || this.hasDefChanged();
        return (
            <div>
                <Form>
                    <Form.Group controlId='formWord'>
                        <Form.Label>Word</Form.Label>
                        <Form.Control 
                            type='text' defaultValue={word.text}
                            onChange={e => {this.changeWordText(e.target.value)}}
                        />
                    </Form.Group>

                    <Form.Group controlId='formPOS'>
                        <Form.Label>Part of Speech</Form.Label>
                        <Form.Control 
                            as="select" 
                            defaultValue={part_of_speech_option} 
                            onChange={e => {this.changePartOfSpeech(e.target.value)}}
                        >
                            {posOptions}
                        </Form.Control>
                    </Form.Group>

                    <Form.Group controlId='formDefinition'>
                        <Form.Label>Definition</Form.Label>
                        <Form.Control as="textarea" defaultValue={word.definition} 
                            onChange={e => this.changeDefinition(e.target.value)}
                        />
                    </Form.Group>

                    <Button 
                            variant={hasChanged ? 'outline-primary' : 'outline-secondary'} 
                            block href='#'
                            disabled={!hasChanged}
                            onClick={e => this.saveWord(() => this.getWord())}
                        >Save</Button>
                </Form>
            </div>
        );
    }

    wordSimple(word) {
        let part_of_speech_option = word.part_of_speech.toLowerCase().replace('_', ' ');
        return (
            <div>
                <h4>{word.text}</h4>
                <p><em>{part_of_speech_option}</em></p>
                <p>{word.definition}</p>
            </div>
        );
    }

    hasTextChanged() {
        let { word, text } = this.state;
        return text != null && text != word.text;
    }

    hasPosChanged() {
        let { word, part_of_speech } = this.state;
        return part_of_speech != null && part_of_speech != word.part_of_speech;
    }

    hasDefChanged() {
        let { word, definition } = this.state;
        return definition != null && definition != word.definition;
    }

    hasSentenceChanged(sentenceId) {
        let { sentencesUpdates, word, suggestedSentences } = this.state;
        let all_sentences = word.sentences.concat(suggestedSentences);
        let sentence = all_sentences.find(sentence => sentence._id == sentenceId);
        let sentenceText;
        if (sentence == null) {
            sentence = all_sentences.find(sentence => sentence._id == sentenceId);
            if (sentence == null) { // no matching sentence found
                return false;
            }
            sentenceText = sentence.paiute;
        } else {
            sentenceText = sentence.english;
        }
        return sentencesUpdates[sentenceId] != null && sentencesUpdates[sentenceId] != sentenceText;
    }

    hasAnySentenceChanged() {
        let { sentencesUpdates } = this.state;
        return Object.keys(sentencesUpdates).some(sentenceId => {
            return this.hasSentenceChanged(sentenceId);
        });
    }

    hasChanged() {
        return (
            this.hasTextChanged() || this.hasPosChanged() ||
            this.hasDefChanged() || this.hasAnySentenceChanged()
        );
    }

    addSentence() { 
        if (!this.canEdit()) {
            console.error("This user cannot make edits!")
            return;
        }
        api.post('/api/sentence', 
            {'paiute': '', 'english': ''},
            {headers: {signed_request: cookie.load('signed_request')}}
        ).then(res => {
            if (res.status != 200 || res.data.success == false) {
                console.log(res.status, res.data);
            } else {
                let { word } = this.state;
                if (word == null) {
                    console.error('Cannot add sentence to invalid word.');
                    return;
                }
                api.post('/api/word/' + this.props.wordId + '/sentence',
                    {sentence: res.data.result._id},
                    {headers: {signed_request: cookie.load('signed_request')}}
                ).then(res => {
                    if (res.status == 200) {
                        this.getWord();
                    } else {
                        console.log(res.status, res.data);
                    }
                }).catch(err => console.error(err));
            }
        }).catch(err => {
            console.error(err);
        });
    }

    render() {
        let { word, suggestedSentences } = this.state;
        let editMode = this.canEdit();

        if (word == null) {
            return null;
        } else if (word == false) {
            return (
                <div className='mt-3 text-center'>
                    <h4>We can't find the word you're looking for!</h4>
                </div>
            );
        }

        let sentenceIds = word.sentences.map((sentence, i) => sentence._id);
        let sentences = word.sentences
            .sort((a, b) => ((a.text == null ? 0 : a.text.length) - (b.text == null ? 0 : b.text.length)))
            .map((sentence, i) => {
                let listItems = editMode ? this.sentenceForm(sentence, i) : this.sentenceSimple(sentence, i);
                return <ListGroup.Item key={'sentence-' + sentence._id}>{listItems}</ListGroup.Item>;
            });
        
        let sentencesList = null;
        if (sentences.length > 0) {
            sentencesList = (
                <Row>
                    <Col>
                        <h5 className='text-center'>Sentences</h5>
                        <ListGroup variant='flush'>
                            {sentences}
                        </ListGroup>
                    </Col>
                </Row>
            );
        }

        let suggSentences = suggestedSentences
            .filter(sentence => !sentenceIds.includes(sentence._id))
            .map((sentence, i) => {
                let listItems = editMode ? this.sentenceForm(sentence, i) : this.sentenceSimple(sentence, i);
                return <ListGroup.Item key={'sentence-' + sentence._id}>{listItems}</ListGroup.Item>;
            });

        let suggSentencesList = null;
        if (suggSentences.length > 0) {
            suggSentencesList = (
                <Row>
                    <Col>
                        <h5 className='text-center'>Suggested Sentences</h5>
                        <ListGroup variant='flush'>
                            {suggSentences}
                        </ListGroup>
                    </Col>
                </Row>
            );
        }

        let addSentenceButton;
        if (editMode) {
            addSentenceButton = (
                <Row>
                    <Col>
                        <Button 
                            className='float-right'
                            variant='outline-primary'
                            onClick={e => this.addSentence()}
                        >
                            <FontAwesomeIcon icon={faPlus} className='mr-2' />
                            Add Sentence
                        </Button>
                    </Col>
                </Row>
            );
        }
        
        let relatedWords = word.words.map((word, i) => {

            return (
                <ListGroup.Item action href={'/word/' + word._id}>
                    <Row>
                        <Col 
                            style={{'paddingRight': '20px', 'borderRight': '1px solid #ccc'}}
                            className='text-right'
                        >
                            <p>{word.text}</p>
                        </Col>
                        <Col>
                            <em>{word.part_of_speech.toLowerCase().replace('_', ' ')}</em>
                        </Col>
                    </Row>
                </ListGroup.Item>
            );
        });

        let relatedWordsList;
        if (relatedWords.length > 0) {
            relatedWordsList = (
                <Row className='mt-3'>
                    <Col>
                        <h5 className='text-center'>See Also</h5>
                        <ListGroup variant='flush'>{relatedWords}</ListGroup>
                    </Col>
                </Row>
            );
        }

        let wordBody = (
            <Row>
                <Col sm={12} md={4} >
                    {editMode ? this.wordForm(word) : this.wordSimple(word)}
                    {relatedWordsList}
                </Col>
                <Col xs={0} style={{'paddingRight': '20px', 'borderRight': '1px solid #ccc'}} className='d-none d-md-block d-xl-block'></Col>
                <Col>
                    {addSentenceButton}
                    {sentencesList}
                    {suggSentencesList}
                </Col>
            </Row>
        );
        return (
            <Row className='m-3'>
                <Col>
                    {this.getDeleteSentenceModal()}
                    {wordBody}
                </Col>
            </Row>
        );
    }
}

export default WordWindow;