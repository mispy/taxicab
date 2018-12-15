import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, action, computed, autorun, reaction, IReactionDisposer} from 'mobx'
import {observer} from 'mobx-react'
import * as _ from 'lodash'
import './index.scss'

@observer
class Main extends React.Component {
    render() {
        return <div className="chargrid">
            test
        </div>
    }
}
    
ReactDOM.render(<Main/>, document.getElementById("root"))