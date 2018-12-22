import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {observable, action, computed, autorun, reaction, IReactionDisposer} from 'mobx'
import {observer} from 'mobx-react'
import * as _ from 'lodash'
import './index.scss'


// A region's erosion level is its geologic index plus the cave system's depth, all modulo 20183. Then:

// If the erosion level modulo 3 is 0, the region's type is rocky.
// If the erosion level modulo 3 is 1, the region's type is wet.
// If the erosion level modulo 3 is 2, the region's type is narrow.

const ROCKY = '.'
const WET = '='
const NARROW = '|'


interface Point {
    x: number
    y: number
}

interface Region {
    x: number
    y: number
    ch: string
}



function riskLevel(region: Region): number {
    if (region.ch === '.')
        return 0
    else if (region.ch === '=')
        return 1
    else if (region.ch === '|')
        return 2  
    else
        throw new Error()
}

class Cave {
    depth: number
    targetPos: Point
    startPos: Point = { x: 0, y: 0 }
    width: number
    height: number

    erosion: number[][] = []
    regions: Region[][] = []

    static fromPuzzle(input: string) {
        const lines = input.trim().split("\n").map(l => l.trim())
        const depth = parseInt(lines[0].split(" ")[1])
        const target = lines[1].split(" ")[1]
        const [tx, ty] = target.split(",").map(s => parseInt(s))
        console.log(tx, ty)
        return new Cave(depth, tx, ty)
    }

    constructor(depth: number, targetX: number, targetY: number) {
        this.depth = depth
        this.targetPos = { x: targetX, y: targetY }
        this.width = targetX+1
        this.height = targetY+1

        for (let y of _.range(this.height)) {
            this.erosion[y] = []
            for (let x of _.range(this.width)) {
                this.erosion[y][x] = this.erosionLevel({x, y})    
            }
        }

        for (let y of _.range(this.height)) {
            this.regions[y] = []
            for (let x of _.range(this.width)) {
                this.regions[y][x] = { x, y, ch: this.regionType({x, y}) }
            }
        }        
    }

    get startRegion() {
        return this.regions[this.startPos.y][this.startPos.x]
    }

    get targetRegion() {
        return this.regions[this.targetPos.y][this.targetPos.x]
    }

    geoIndex(p: Point) {
        // The region at 0,0 (the mouth of the cave) has a geologic index of 0.
        // The region at the coordinates of the target has a geologic index of 0.
        // If the region's Y coordinate is 0, the geologic index is its X coordinate times 16807.
        // If the region's X coordinate is 0, the geologic index is its Y coordinate times 48271.
        // Otherwise, the region's geologic index is the result of multiplying the erosion levels of the regions at X-1,Y and X,Y-1.        
    
        const {targetPos} = this
        if (p.x=== 0 && p.y === 0)
            return 0
        else if (p.x === targetPos.x && p.y === targetPos.y)
            return 0
        else if (p.y === 0)
            return p.x*16807
        else if (p.x === 0)
            return p.y*48271
        else
            return this.erosion[p.y][p.x-1] * this.erosion[p.y-1][p.x]
    }

    erosionLevel(p: Point) {
        return (this.geoIndex(p) + this.depth) % 20183
    }

    regionType(p: Point): string {
        const mod = this.erosionLevel(p) % 3
        if (mod === 0)
            return ROCKY
        else if (mod === 1)
            return WET
        else// if (mod === 2)
            return NARROW
    }

    getChar(reg: Region) {
        if (reg == this.startRegion)
            return "M"
        else if (reg === this.targetRegion)
            return "T"
        else
            return reg.ch
    }

    toString() {
        return this.regions.map(l =>
            l.map(r => this.getChar(r)).join("")
        ).join("\n")
        // let caveP = _.cloneDeep(cave)
        // caveP[0][0] = 'M'
        // caveP[ty][tx] = 'T'
        // aoc.logGrid(caveP)
    }
}

@observer
class AutoScaler extends React.Component<{ children: any }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()
    innerDiv: React.RefObject<HTMLDivElement> = React.createRef()

    @observable gridString: string = ""

    @observable xScale: number = 1
    @observable yScale: number = 1
    @observable translateX: number = 0
    @observable translateY: number = 0

    @action.bound onResize() {
        const targetRect = this.base.current!.getBoundingClientRect()
        const currentRect = this.innerDiv.current!.getBoundingClientRect()
        this.xScale = targetRect.width/(currentRect.width/this.xScale)
        this.yScale = targetRect.height/(currentRect.height/this.yScale)
    }

    componentDidMount() {
        this.onResize()
        window.addEventListener('resize', this.onResize)
    }

    @computed get transform(): string {
        return `scale(${this.xScale}, ${this.yScale})`
    }

    render() {
        return <div ref={this.base} className="StringView">
            <code ref={this.innerDiv} style={{ transform: this.transform }}>
                {this.props.children}
            </code>
        </div>
    }
}

@observer
class FindRiskView extends React.Component<{ cave: Cave, index: number }> {
    render() {
        const {cave, index} = this.props

        let i = 0
        return <AutoScaler>
            {_.range(cave.height).map(y => 
                _.range(cave.width).map(x => {
                    i += 1

                    const reg = cave.regions[y][x]

                    if (i-1 <= index)
                        return <span className="riskRegion">{reg.ch}</span>

                    if (reg === cave.startRegion)
                        return <span className="startRegion">{reg.ch}</span>
                    else if (reg === cave.targetRegion)
                        return <span className="targetRegion">{reg.ch}</span>
                    else
                        return reg.ch
                }).concat([<br/>])
            )}
        </AutoScaler>
    }
}

@observer
class Main extends React.Component {
    @observable puzzleInput = `depth: 510\ntarget: 10,10\n`
    @observable cave: Cave = Cave.fromPuzzle(this.puzzleInput)

    @observable findRiskIndex: number = -1
    @observable risk: number = 0

    @action.bound onPuzzleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
        this.puzzleInput = e.currentTarget.value
    }

    @action.bound readPuzzle(input: string) {
        this.cave = Cave.fromPuzzle(input)
    }

    @action.bound onFindRisk() {
        this.findRiskIndex = 0
        this.findRiskFrame()
    }

    @action.bound findRiskFrame() {
        this.findRiskIndex += 1

        const y = Math.floor(this.findRiskIndex / this.cave.height)
        const x = this.findRiskIndex % this.cave.height

        this.risk += riskLevel(this.cave.regions[y][x])

        if (this.findRiskIndex >= this.cave.width*this.cave.height)
            this.findRiskIndex = -1
        else {
            requestAnimationFrame(this.findRiskFrame)
        }
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = autorun(() => this.readPuzzle(this.puzzleInput))
    }

    componentWillUnmount() {
        this.dispose()
    }

    render() {
        console.log(this.cave.toString())
        return <main>
            <textarea value={this.puzzleInput} onChange={this.onPuzzleInput}/>
            <FindRiskView cave={this.cave} index={this.findRiskIndex}/>
            {this.findRiskIndex >= 0 && <div>{this.risk}</div>}
            <button className="btn btn-success" onClick={this.onFindRisk}>Find risk level</button>
        </main>
    }
}

ReactDOM.render(<Main/>, document.getElementById("root"))