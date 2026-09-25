import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiError} from '../utils/ApiError.js'
import { User } from "../models/user.model.js"
import {uploadOnCloud} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Access and Refresh Tokens")
    }
}
const registerUser = asyncHandler( async (req, res) => {
   // Get user details from front-end
   // Validation - not empty
   // Check if user already exists: username, email
   // Check for images, check for avatar
   // upload them to cloudinary, avatar
   // create user object - create entry in db
   // remove password and refresh tolen field from response
   // check for user creation
   // return res
   
   const {fullname, email, username, password} = req.body
   console.log("email: ", email);
   console.log("fullname: ", fullname);
   console.log("username: ", username);
   console.log("password: ", password);

   // validation
   if(
    [fullname, email, username, password].some((field) => field?.trim() === "")
   ){
    throw new ApiError(400, "All Fields are required")
   }

//    if(fullName === ""){
//     throw new ApiError(400, "Full Name is required")
//    }


// Check if user already exists
   
const existedUser = await User.findOne({
    $or: [{username},{email}]
})

if (existedUser){
    throw new ApiError(409, "User with email or username already exists")
}

// Check for images, check for Avatar

console.log("REQ FILES :", req.files);


const avatarLocalPath = req.files?.avatar?.[0]?.path

const coverImageLocalPath = req.files?.coverImage?.[0]?.path

// let coverImageLocalPath;

// if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
//   coverImageLocalPath = req.files.coverImage[0]
// }

// console.log("avatarLocalPath =", avatarLocalPath);

// console.log("coverImageLocalPath =", coverImageLocalPath);

// console.log("typeof avatarLocalPath =", typeof avatarLocalPath);




if(!avatarLocalPath){
    throw new ApiError(400, "Avatar file is required")
}

// Upload on Cloudinary

const avatar = await uploadOnCloud(avatarLocalPath)

const coverImage = await uploadOnCloud(coverImageLocalPath)

console.log("avatar from Cloudinary:", avatar);
console.log("coverImage from Cloudinary:", coverImage);

if(!avatar){
    throw new ApiError(400, "Avatar file is required")
}

// Create User Object - create entry in db

const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage.url || "",
    email,
    password,
    username: username.toLowerCase()
})

// check for user creation
const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
)

if (!createdUser){
    throw new ApiError(500, "Something went wrong while registering the user")
}

// return res

return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered successfully")
)
})

const loginUser = asyncHandler( async (req, res) => {
    // req body -> data
    // username or email
    // find the user
    // password check
    // access and refresh token
    // send cookies
    
    const {email, username, password} = req.body

    if (!(username || email)){
        throw new ApiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or : [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id)
    .select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse( 200, {
            user: loggedInUser, accessToken, refreshToken
        },
        "User logged in successfully"
    
    )
    )

})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User Logged out"))
})

// Refresh token end point

const refreshAccessToken = asyncHandler(async (req, res) => {
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

   if(!refreshAccessToken){
    throw new ApiError(401, "Unauthorized Request")
   }

  try {
    const decodedToken = jwt.verify(
    incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET
   )
   
  const user = await User.findById(decodedToken?._id)

  if(!user){
    throw new ApiError(401, "Invalid refresh token")
  }
  if(!incomingRefreshToken !== user?.refreshToken){
    throw new ApiError(401, "Refresh token is expired or used")
  }

  const options = {
    httpOnly: true,
    secure: true
  }

  const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)

  return res.
  status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", newRefreshToken, options)
  .json(
    new ApiResponse(
        200,
        {accessToken, refreshToken: newRefreshToken},
        "Access token refreshed"
    )
  )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }
})

export {registerUser,
    loginUser,logoutUser, refreshAccessToken
}